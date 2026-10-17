// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { RegistroActores } from "./RegistroActores.sol";
import { IHistorialReputacion } from "./HistorialReputacion.sol";

interface IReciboDonacion {
    function emitirRecibo(address donante) external returns (uint256 tokenId);
}

/// @title CampanaEmergencia
/// @notice Núcleo del sistema. El dinero NUNCA pasa por la fundación: queda en este contrato
///         y, cuando una etapa se aprueba, va directo a la wallet del proveedor registrado.
///         La fundación solo PROPONE cómo gastarlo.
///
///         Una etapa se paga cuando se cumplen DOS señales independientes:
///          1. Verificadores (umbral, p. ej. 2 de 3) confirman la entrega con evidencia pública.
///          2. La comunidad: un porcentaje de las familias del censo confirma que recibió
///             (cada familia firma con la llave de su tarjeta QR; el gas lo paga un patrocinador).
///
///         Controles anticorrupción:
///          - Sobrecosto: si el precio por unidad de la factura supera el de referencia en más
///            del 10 %, la etapa queda marcada y exige un verificador más.
///          - Conteo en campo: cada verificador reporta cuántas unidades contó al confirmar. Si
///            contó menos de las que dice la factura, su voto cuenta como rechazo.
///          - Conflicto de interés: la fundación, un verificador, una empresa aliada o un
///            beneficiario no pueden ser el proveedor que cobra.
///          - Si una etapa se rechaza, vence o la fundación cancela, cada donante reclama la
///            parte proporcional de lo que no se ha pagado.
///
///         Matching: una empresa aliada bloquea fondos en el contrato y "duplica" (o la
///         proporción que elija) cada donación hasta un tope. Lo no usado se le devuelve al
///         cerrar el recaudo.
/// @dev Ciclo de la campaña:  Recaudando → EnEjecucion → Finalizada
///                                     ↘            ↘
///                                        Reembolso
///      Ciclo de cada etapa:  Pendiente → Propuesta → Aprobada → Pagada   (o Rechazada)
///      "Aprobada" = los verificadores ya aprobaron y falta el quórum de la comunidad.
///
///      Contabilidad proporcional: las donaciones solo se aceptan mientras se recauda, así que la
///      participación de cada donante (aporte / totalRecaudado) queda fija antes del primer pago.
///      De cada pago, la parte de un donante es aporte * montoEtapa / totalRecaudado.
///
///      Todo lo que el frontend necesita se puede leer con funciones view (sin eventos), porque el
///      RPC público de Monad testnet limita eth_getLogs a rangos de 100 bloques.
///
///      ERC-2771: todas las acciones usan _msgSender(), así que cualquiera puede actuar sin gas
///      firmando una solicitud que el ReenviadorGas entrega.
contract CampanaEmergencia is ERC2771Context, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ───────────────────────────── Tipos ─────────────────────────────

    enum EstadoCampana {
        Recaudando,
        EnEjecucion,
        Finalizada,
        Reembolso
    }

    enum EstadoEtapa {
        Pendiente,
        Propuesta,
        Aprobada,
        Pagada,
        Rechazada
    }

    enum Voto {
        Ninguno,
        Confirma,
        Rechaza
    }

    enum MotivoReembolso {
        Ninguno,
        EtapaRechazada,
        PlazoVencido,
        Cancelada
    }

    struct Etapa {
        string descripcion;
        uint16 porcentajeBps; // 3000 = 30 %
        uint64 plazo; // segundos que tiene la etapa para pagarse desde que se habilita
        uint64 fechaLimite; // se fija al habilitarse la etapa (0 = aún no habilitada)
        EstadoEtapa estado;
        uint8 confirmaciones;
        uint8 rechazos;
        uint8 confirmacionesRequeridas; // el umbral, o uno más si hay sobrecosto
        uint8 rechazosRequeridos;
        bool sobrecosto;
        bool unidadesNoCuadran; // algún verificador contó menos unidades de las facturadas
        address proveedor;
        uint256 monto; // se calcula al cerrar el recaudo
        bytes32 hashEvidencia; // keccak256 del documento de evidencia (factura, fecha, ubicación)
        string uriEvidencia; // ipfs://<cid> de ese documento
        uint256 precioReferencia; // precio de referencia por unidad (0 = sin referencia)
        string unidad; // "mercado familiar", "kit de techo"...
        uint32 unidades; // unidades que la factura dice entregar
        uint32 confirmacionesBeneficiarios;
        uint32 beneficiariosRequeridos; // quórum de la comunidad, fijado al proponer
        uint64 bloquePropuesta;
        uint64 fechaPropuesta;
        uint64 bloquePago; // permite ubicar el tx del pago con un getLogs de 1 bloque
        uint64 fechaPago;
    }

    struct RegistroDonacion {
        address donante;
        uint64 bloque;
        uint128 monto;
        uint64 fecha;
    }

    struct Matching {
        address empresa;
        uint16 proporcionBps; // 10000 = duplica cada donación
        uint128 tope;
        uint128 usado;
        uint64 fecha;
    }

    struct ConfigCampana {
        string nombre;
        string descripcion;
        uint256 meta;
        uint64 duracionRecaudo; // segundos
        address[] verificadores;
        uint8 umbral; // confirmaciones necesarias (2 de 3)
        string[] descripcionesEtapas;
        uint16[] porcentajesBps; // deben sumar 10000
        uint64[] plazosEtapas; // segundos
        uint256[] preciosReferencia; // vacío = ninguna etapa tiene precio de referencia
        string[] unidadesReferencia; // misma longitud que preciosReferencia
        uint16 quorumBeneficiariosBps; // % del censo que debe confirmar cada etapa (0 = no aplica)
    }

    struct Dependencias {
        IERC20 token;
        RegistroActores registro;
        IReciboDonacion recibo;
        IHistorialReputacion reputacion;
        address reenviador; // ERC-2771: el contrato que entrega las firmas con gas patrocinado
    }

    struct InfoCampana {
        address direccion;
        string nombre;
        string descripcion;
        address fundacion;
        address token;
        uint256 meta;
        uint256 totalRecaudado;
        uint256 totalPagado;
        uint256 totalReembolsado;
        EstadoCampana estado;
        MotivoReembolso motivoReembolso;
        uint256 etapaActual;
        uint256 numeroEtapas;
        uint256 numeroDonantes;
        uint256 numeroDonaciones;
        uint64 fechaCierreRecaudo;
        uint64 bloqueCreacion;
        uint8 umbral;
        uint8 rechazosParaRechazar;
        address[] verificadores;
        uint64 fechaCreacion;
        uint64 fechaRecaudoCerrado;
        uint64 fechaReembolso;
        uint16 quorumBeneficiariosBps;
        uint256 numeroBeneficiarios;
        uint256 matchingBloqueado;
        uint256 matchingUsado;
    }

    struct ResumenDonante {
        uint256 aporte;
        uint256 totalRecaudado;
        uint256[] partePorEtapa; // parte del donante en cada etapa (planeada o pagada)
        uint256 pagadoAProveedores; // suma de su parte en etapas ya pagadas
        uint256 reembolsable; // lo que puede reclamar ahora mismo
        uint256 reembolsado; // lo que ya reclamó
        uint256 pendiente; // aún en el contrato, sin pagar ni reembolsar
        uint256 recibo; // id del NFT de recibo (0 si no tiene)
        uint256 matchingGenerado; // lo que las empresas aliadas sumaron gracias a sus donaciones
    }

    // ───────────────────────────── Constantes ─────────────────────────────

    uint16 public constant BPS = 10_000;
    uint256 public constant MAX_ETAPAS = 10;
    uint256 public constant MAX_VERIFICADORES = 7;
    /// @notice Un precio por unidad más de 10 % por encima del de referencia es sobrecosto.
    uint16 public constant TOLERANCIA_SOBRECOSTO_BPS = 1000;
    uint256 public constant MAX_BENEFICIARIOS = 1000;
    uint256 public constant MAX_LOTE_BENEFICIARIOS = 200;
    uint256 public constant MAX_MATCHINGS = 3;
    uint16 public constant MAX_PROPORCION_MATCHING_BPS = 30_000; // hasta triplicar

    // ───────────────────────────── Estado ─────────────────────────────

    IERC20 public immutable token;
    RegistroActores public immutable registro;
    IReciboDonacion public immutable recibo;
    IHistorialReputacion public immutable reputacion;
    address public immutable fundacion;
    uint256 public immutable meta;
    uint64 public immutable fechaCierreRecaudo;
    uint64 public immutable bloqueCreacion;
    uint64 public immutable fechaCreacion;
    uint8 public immutable umbral;
    uint8 public immutable rechazosParaRechazar;
    uint16 public immutable quorumBeneficiariosBps;

    string public nombre;
    string public descripcion;

    EstadoCampana public estado;
    MotivoReembolso public motivoReembolso;
    uint256 public etapaActual;
    uint64 public fechaRecaudoCerrado;
    uint64 public fechaReembolso;

    uint256 public totalRecaudado;
    uint256 public totalPagado;
    uint256 public totalReembolsado;
    /// @notice Fondos de matching en el contrato que todavía no se han usado.
    uint256 public matchingBloqueado;
    uint256 public matchingUsado;

    mapping(address => uint256) public aportes;
    mapping(address => uint256) public montoReembolsado;
    mapping(address => uint256) public reciboDe;
    mapping(address => uint256) public matchingGenerado;
    mapping(address => bool) public esVerificadorDeCampana;
    mapping(address => bool) public esEmpresaDeCampana;
    mapping(address => bool) public esBeneficiario;
    mapping(uint256 => mapping(address => Voto)) public votoDe;
    mapping(uint256 => mapping(address => bytes32)) public evidenciaVotoDe;
    mapping(uint256 => mapping(address => string)) public uriVotoDe;
    /// @notice Unidades que cada verificador contó en campo (0 si la factura no declaró unidades).
    mapping(uint256 => mapping(address => uint32)) public unidadesContadasDe;
    mapping(uint256 => mapping(address => bool)) public recepcionDe;

    address[] private _verificadores;
    Etapa[] private _etapas;
    address[] private _donantes;
    RegistroDonacion[] private _donaciones;
    address[] private _beneficiarios;
    Matching[] private _matchings;

    // ───────────────────────────── Eventos ─────────────────────────────

    event Donacion(
        address indexed donante, uint256 monto, uint256 aporteTotal, uint256 totalRecaudado
    );
    event RecaudoCerrado(uint256 totalRecaudado);
    event DesembolsoPropuesto(
        uint256 indexed etapa,
        address indexed proveedor,
        uint256 monto,
        bytes32 hashEvidencia,
        string uriEvidencia,
        bool sobrecosto
    );
    event SobrecostoDetectado(
        uint256 indexed etapa, uint256 precioUnitario, uint256 precioReferencia
    );
    event EntregaConfirmada(
        uint256 indexed etapa,
        address indexed verificador,
        bytes32 hashActa,
        string uriActa,
        uint8 confirmaciones
    );
    event VotoRechazo(
        uint256 indexed etapa,
        address indexed verificador,
        bytes32 hashMotivo,
        string uriMotivo,
        uint8 rechazos
    );
    event UnidadesNoCuadran(
        uint256 indexed etapa, address indexed verificador, uint32 facturadas, uint32 contadas
    );
    event BeneficiariosRegistrados(address indexed verificador, uint256 cantidad, uint256 total);
    event RecepcionConfirmada(uint256 indexed etapa, address indexed beneficiario, uint32 total);
    event EtapaAprobada(uint256 indexed etapa);
    event FondosLiberados(uint256 indexed etapa, address indexed proveedor, uint256 monto);
    event EtapaRechazada(uint256 indexed etapa);
    event MatchingComprometido(address indexed empresa, uint16 proporcionBps, uint256 tope);
    event MatchingAplicado(address indexed empresa, address indexed donante, uint256 monto);
    event MatchingDevuelto(address indexed empresa, uint256 monto);
    event ReembolsoActivado(MotivoReembolso motivo, uint256 etapa);
    event ReembolsoReclamado(address indexed donante, uint256 monto);
    event CampanaFinalizada(uint256 totalPagado);

    // ───────────────────────────── Errores ─────────────────────────────

    error ConfigInvalida(string motivo);
    error SoloFundacion();
    error SoloVerificador();
    error SoloEmpresa();
    error EstadoInvalido();
    error EtapaInvalida();
    error EstadoEtapaInvalido();
    error MontoCero();
    error RecaudoVencido();
    error SinFondos();
    error NoAutorizado();
    error PlazoVencido();
    error PlazoNoVencido();
    error ProveedorNoAutorizado(address proveedor);
    error ConflictoDeInteres(address cuenta);
    error YaVoto();
    error HashVacio();
    error PermisoInvalido();
    error NadaQueReclamar();
    error UnidadesRequeridas();
    error ConteoRequerido();
    error SinCenso();
    error CensoLleno();
    error BeneficiarioInvalido(address cuenta);
    error NoEsBeneficiario();
    error YaConfirmo();
    error MatchingInvalido();
    error MatchingDuplicado();
    error DemasiadosMatchings();

    // ───────────────────────────── Modificadores ─────────────────────────────

    modifier soloFundacion() {
        if (_msgSender() != fundacion) revert SoloFundacion();
        _;
    }

    modifier soloVerificador() {
        // Debe estar en la lista de esta campaña Y seguir activo en el registro.
        address v = _msgSender();
        if (!esVerificadorDeCampana[v] || !registro.esVerificador(v)) revert SoloVerificador();
        _;
    }

    // ───────────────────────────── Constructor ─────────────────────────────

    constructor(Dependencias memory dep, address fundacion_, ConfigCampana memory cfg)
        ERC2771Context(dep.reenviador)
    {
        if (
            address(dep.token) == address(0) || address(dep.registro) == address(0)
                || address(dep.reputacion) == address(0)
        ) {
            revert ConfigInvalida("direcciones");
        }
        if (!dep.registro.esFundacion(fundacion_)) revert ConfigInvalida("fundacion no registrada");
        if (bytes(cfg.nombre).length == 0) revert ConfigInvalida("nombre");
        if (cfg.meta == 0 || cfg.meta > type(uint128).max) revert ConfigInvalida("meta");
        if (cfg.duracionRecaudo == 0 || cfg.duracionRecaudo > 365 days) {
            revert ConfigInvalida("duracion recaudo");
        }
        if (cfg.quorumBeneficiariosBps > BPS) revert ConfigInvalida("quorum beneficiarios");

        // Etapas
        uint256 n = cfg.descripcionesEtapas.length;
        if (n == 0 || n > MAX_ETAPAS) revert ConfigInvalida("numero de etapas");
        if (cfg.porcentajesBps.length != n || cfg.plazosEtapas.length != n) {
            revert ConfigInvalida("longitudes de etapas");
        }
        uint256 nr = cfg.preciosReferencia.length;
        if ((nr != 0 && nr != n) || cfg.unidadesReferencia.length != nr) {
            revert ConfigInvalida("precios de referencia");
        }
        uint256 suma;
        for (uint256 i = 0; i < n; i++) {
            if (bytes(cfg.descripcionesEtapas[i]).length == 0) revert ConfigInvalida("descripcion");
            if (cfg.porcentajesBps[i] == 0) revert ConfigInvalida("porcentaje cero");
            if (cfg.plazosEtapas[i] == 0 || cfg.plazosEtapas[i] > 365 days) {
                revert ConfigInvalida("plazo");
            }
            suma += cfg.porcentajesBps[i];
            Etapa storage e = _etapas.push();
            e.descripcion = cfg.descripcionesEtapas[i];
            e.porcentajeBps = cfg.porcentajesBps[i];
            e.plazo = cfg.plazosEtapas[i];
            if (nr != 0 && cfg.preciosReferencia[i] != 0) {
                if (bytes(cfg.unidadesReferencia[i]).length == 0) revert ConfigInvalida("unidad");
                e.precioReferencia = cfg.preciosReferencia[i];
                e.unidad = cfg.unidadesReferencia[i];
            }
        }
        if (suma != BPS) revert ConfigInvalida("porcentajes deben sumar 100%");

        // Verificadores
        uint256 nv = cfg.verificadores.length;
        if (nv < 2 || nv > MAX_VERIFICADORES) revert ConfigInvalida("numero de verificadores");
        if (cfg.umbral < 2 || cfg.umbral > nv) revert ConfigInvalida("umbral");
        for (uint256 i = 0; i < nv; i++) {
            address v = cfg.verificadores[i];
            if (v == address(0) || v == fundacion_) revert ConfigInvalida("verificador");
            if (!dep.registro.esVerificador(v)) revert ConfigInvalida("verificador no registrado");
            if (esVerificadorDeCampana[v]) revert ConfigInvalida("verificador repetido");
            esVerificadorDeCampana[v] = true;
            _verificadores.push(v);
        }

        token = dep.token;
        registro = dep.registro;
        recibo = dep.recibo;
        reputacion = dep.reputacion;
        fundacion = fundacion_;
        meta = cfg.meta;
        nombre = cfg.nombre;
        descripcion = cfg.descripcion;
        umbral = cfg.umbral;
        quorumBeneficiariosBps = cfg.quorumBeneficiariosBps;
        // Una etapa queda rechazada cuando ya es imposible llegar al umbral (2 de 3 → 2 rechazos).
        // casting to uint8 is safe because nv <= MAX_VERIFICADORES (7)
        // forge-lint: disable-next-line(unsafe-typecast)
        rechazosParaRechazar = uint8(nv - cfg.umbral + 1);
        fechaCreacion = uint64(block.timestamp);
        fechaCierreRecaudo = uint64(block.timestamp) + cfg.duracionRecaudo;
        bloqueCreacion = uint64(block.number);
    }

    // ───────────────────────────── Donaciones ─────────────────────────────

    /// @notice Dona `monto` MockCOP. Requiere `approve` previo a este contrato.
    /// @dev Si la donación supera lo que falta para la meta, solo se cobra lo que falta.
    function donar(uint256 monto) external nonReentrant {
        _donar(_msgSender(), monto);
    }

    /// @notice Dona en una sola transacción usando una firma ERC-2612 (sin approve previo).
    ///         Combinado con el ReenviadorGas, el donante no necesita tener gas.
    function donarConPermit(uint256 monto, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        address donante = _msgSender();
        // Si alguien adelantó el permit (front-running), la allowance ya existe: seguimos igual.
        try IERC20Permit(address(token)).permit(donante, address(this), monto, deadline, v, r, s)
        { } catch {
            if (token.allowance(donante, address(this)) < monto) revert PermisoInvalido();
        }
        _donar(donante, monto);
    }

    function _donar(address donante, uint256 monto) private {
        if (estado != EstadoCampana.Recaudando) revert EstadoInvalido();
        if (block.timestamp > fechaCierreRecaudo) revert RecaudoVencido();
        if (monto == 0) revert MontoCero();

        uint256 restante = meta - totalRecaudado;
        uint256 aceptado = monto > restante ? restante : monto;

        bool primera = _acreditar(donante, aceptado);
        token.safeTransferFrom(donante, address(this), aceptado);
        emit Donacion(donante, aceptado, aportes[donante], totalRecaudado);

        // Bonus: NFT de recibo en la primera donación. Si falla, la donación sigue siendo válida.
        if (primera && address(recibo) != address(0)) {
            try recibo.emitirRecibo(donante) returns (uint256 id) {
                reciboDe[donante] = id;
            } catch { }
        }

        _aplicarMatching(donante, aceptado);
        if (totalRecaudado == meta) _cerrarRecaudo();
    }

    /// @dev Suma un aporte a la contabilidad (donación propia o matching de una empresa).
    function _acreditar(address cuenta, uint256 monto) private returns (bool primera) {
        primera = aportes[cuenta] == 0;
        if (primera) _donantes.push(cuenta);
        aportes[cuenta] += monto;
        totalRecaudado += monto;
        _donaciones.push(
            RegistroDonacion({
                donante: cuenta,
                bloque: uint64(block.number),
                // casting to uint128 is safe because monto <= meta <= type(uint128).max
                // forge-lint: disable-next-line(unsafe-typecast)
                monto: uint128(monto),
                fecha: uint64(block.timestamp)
            })
        );
    }

    // ───────────────────────────── Matching de empresas ─────────────────────────────

    /// @notice Una empresa aliada bloquea `tope` MockCOP y suma `proporcionBps` de cada donación
    ///         (10000 = la duplica) hasta agotarlo. Requiere `approve` previo por `tope`.
    ///         Lo que no se use se le devuelve al cerrar el recaudo. Lo usado cuenta como su
    ///         aporte: si hay reembolso, recupera su parte como cualquier donante.
    function comprometerMatching(uint16 proporcionBps, uint256 tope) external nonReentrant {
        address empresa = _msgSender();
        if (!registro.esEmpresa(empresa)) revert SoloEmpresa();
        if (estado != EstadoCampana.Recaudando) revert EstadoInvalido();
        if (block.timestamp > fechaCierreRecaudo) revert RecaudoVencido();
        if (proporcionBps == 0 || proporcionBps > MAX_PROPORCION_MATCHING_BPS) {
            revert MatchingInvalido();
        }
        if (tope == 0 || tope > meta - totalRecaudado) revert MatchingInvalido();
        if (empresa == fundacion || esVerificadorDeCampana[empresa]) {
            revert ConflictoDeInteres(empresa);
        }
        if (esEmpresaDeCampana[empresa]) revert MatchingDuplicado();
        if (_matchings.length >= MAX_MATCHINGS) revert DemasiadosMatchings();

        esEmpresaDeCampana[empresa] = true;
        _matchings.push(
            Matching({
                empresa: empresa,
                proporcionBps: proporcionBps,
                // casting to uint128 is safe because tope <= meta <= type(uint128).max
                // forge-lint: disable-next-line(unsafe-typecast)
                tope: uint128(tope),
                usado: 0,
                fecha: uint64(block.timestamp)
            })
        );
        matchingBloqueado += tope;
        token.safeTransferFrom(empresa, address(this), tope);
        emit MatchingComprometido(empresa, proporcionBps, tope);
    }

    function _aplicarMatching(address donante, uint256 base) private {
        uint256 n = _matchings.length;
        for (uint256 i = 0; i < n; i++) {
            uint256 restante = meta - totalRecaudado;
            if (restante == 0) return;
            Matching storage m = _matchings[i];
            if (m.empresa == donante) continue; // una empresa no se "duplica" a sí misma
            uint256 extra = (base * m.proporcionBps) / BPS;
            uint256 libre = m.tope - m.usado;
            if (extra > libre) extra = libre;
            if (extra > restante) extra = restante;
            if (extra == 0) continue;
            // casting to uint128 is safe because extra <= m.tope (uint128)
            // forge-lint: disable-next-line(unsafe-typecast)
            m.usado += uint128(extra);
            matchingBloqueado -= extra;
            matchingUsado += extra;
            matchingGenerado[donante] += extra;
            _acreditar(m.empresa, extra);
            emit MatchingAplicado(m.empresa, donante, extra);
        }
    }

    /// @dev Al terminar el recaudo cada empresa recupera lo que no se usó.
    function _liquidarMatching() private {
        uint256 n = _matchings.length;
        for (uint256 i = 0; i < n; i++) {
            Matching storage m = _matchings[i];
            uint256 sobrante = m.tope - m.usado;
            if (sobrante != 0) {
                m.tope = m.usado;
                matchingBloqueado -= sobrante;
                token.safeTransfer(m.empresa, sobrante);
                emit MatchingDevuelto(m.empresa, sobrante);
            }
            reputacion.registrar(m.empresa, IHistorialReputacion.Evento.MatchingLiquidado, m.usado);
        }
    }

    // ───────────────────────────── Cierre del recaudo ─────────────────────────────

    /// @notice Cierra el recaudo y habilita la primera etapa. La fundación puede cerrarlo cuando
    ///         quiera; cualquiera puede cerrarlo cuando vence el plazo de recaudo.
    function cerrarRecaudo() external nonReentrant {
        if (estado != EstadoCampana.Recaudando) revert EstadoInvalido();
        if (_msgSender() != fundacion && block.timestamp <= fechaCierreRecaudo) {
            revert NoAutorizado();
        }
        if (totalRecaudado == 0) revert SinFondos();
        _cerrarRecaudo();
    }

    function _cerrarRecaudo() private {
        estado = EstadoCampana.EnEjecucion;
        fechaRecaudoCerrado = uint64(block.timestamp);
        uint256 total = totalRecaudado;
        uint256 n = _etapas.length;
        uint256 asignado;
        for (uint256 i = 0; i < n; i++) {
            // La última etapa toma el residuo para que no quede polvo por redondeo.
            uint256 m = i == n - 1 ? total - asignado : (total * _etapas[i].porcentajeBps) / BPS;
            _etapas[i].monto = m;
            asignado += m;
        }
        etapaActual = 0;
        _etapas[0].fechaLimite = uint64(block.timestamp) + _etapas[0].plazo;
        emit RecaudoCerrado(total);
        _liquidarMatching();
    }

    // ───────────────────────────── Censo de beneficiarios ─────────────────────────────

    /// @notice Un verificador (p. ej. la Junta de Acción Comunal, que conoce a las familias)
    ///         registra las cuentas de las familias damnificadas. Cada familia recibe una tarjeta
    ///         con un QR que contiene su llave; con ella confirma, sin gas, que recibió la ayuda.
    /// @dev La fundación no puede cargar el censo: así no puede inventarse beneficiarios.
    function registrarBeneficiarios(address[] calldata cuentas) external soloVerificador {
        if (estado != EstadoCampana.Recaudando && estado != EstadoCampana.EnEjecucion) {
            revert EstadoInvalido();
        }
        uint256 n = cuentas.length;
        if (n == 0 || n > MAX_LOTE_BENEFICIARIOS) revert ConfigInvalida("lote de beneficiarios");
        if (_beneficiarios.length + n > MAX_BENEFICIARIOS) revert CensoLleno();
        for (uint256 i = 0; i < n; i++) {
            address b = cuentas[i];
            if (
                b == address(0) || esBeneficiario[b] || b == fundacion
                    || esVerificadorDeCampana[b] || esEmpresaDeCampana[b] || registro.esProveedor(b)
            ) revert BeneficiarioInvalido(b);
            esBeneficiario[b] = true;
            _beneficiarios.push(b);
        }
        emit BeneficiariosRegistrados(_msgSender(), n, _beneficiarios.length);
    }

    /// @notice Una familia del censo confirma que recibió la ayuda de la etapa actual.
    ///         Normalmente llega por el ReenviadorGas (la familia no tiene cripto).
    function confirmarRecepcion(uint256 idEtapa) external nonReentrant {
        address b = _msgSender();
        if (!esBeneficiario[b]) revert NoEsBeneficiario();
        if (estado != EstadoCampana.EnEjecucion) revert EstadoInvalido();
        if (idEtapa != etapaActual) revert EtapaInvalida();
        Etapa storage e = _etapas[idEtapa];
        if (e.estado != EstadoEtapa.Propuesta && e.estado != EstadoEtapa.Aprobada) {
            revert EstadoEtapaInvalido();
        }
        if (block.timestamp > e.fechaLimite) revert PlazoVencido();
        if (recepcionDe[idEtapa][b]) revert YaConfirmo();

        recepcionDe[idEtapa][b] = true;
        e.confirmacionesBeneficiarios += 1;
        emit RecepcionConfirmada(idEtapa, b, e.confirmacionesBeneficiarios);
        _intentarLiberar(idEtapa, e);
    }

    // ───────────────────────────── Etapas ─────────────────────────────

    /// @notice La fundación propone pagar la etapa actual a un proveedor registrado.
    /// @param hashEvidencia keccak256 del documento de evidencia (factura + fecha + ubicación).
    /// @param uriEvidencia ipfs://<cid> donde cualquiera puede ver ese documento.
    /// @param unidades cuántas unidades dice la factura (mercados, kits...). Obligatorio si la
    ///        etapa tiene precio de referencia: con él se calcula el precio por unidad.
    function proponerDesembolso(
        uint256 idEtapa,
        address proveedor,
        bytes32 hashEvidencia,
        string calldata uriEvidencia,
        uint32 unidades
    ) external soloFundacion {
        if (estado != EstadoCampana.EnEjecucion) revert EstadoInvalido();
        if (idEtapa != etapaActual) revert EtapaInvalida();
        Etapa storage e = _etapas[idEtapa];
        if (e.estado != EstadoEtapa.Pendiente) revert EstadoEtapaInvalido();
        if (block.timestamp > e.fechaLimite) revert PlazoVencido();
        if (hashEvidencia == bytes32(0)) revert HashVacio();
        if (!registro.esProveedor(proveedor)) revert ProveedorNoAutorizado(proveedor);
        if (
            proveedor == fundacion || esVerificadorDeCampana[proveedor]
                || esEmpresaDeCampana[proveedor] || esBeneficiario[proveedor]
        ) {
            revert ConflictoDeInteres(proveedor);
        }
        uint256 censo = _beneficiarios.length;
        if (quorumBeneficiariosBps != 0 && censo == 0) revert SinCenso();

        // Alerta de sobrecosto: precio por unidad = monto de la etapa / unidades de la factura.
        bool sobrecosto;
        if (e.precioReferencia != 0) {
            if (unidades == 0) revert UnidadesRequeridas();
            uint256 precioUnitario = e.monto / unidades;
            sobrecosto = precioUnitario * BPS > e.precioReferencia * (BPS + TOLERANCIA_SOBRECOSTO_BPS);
            if (sobrecosto) emit SobrecostoDetectado(idEtapa, precioUnitario, e.precioReferencia);
        }
        uint256 nv = _verificadores.length;
        uint8 requeridas = sobrecosto && umbral < nv ? umbral + 1 : umbral;

        e.proveedor = proveedor;
        e.hashEvidencia = hashEvidencia;
        e.uriEvidencia = uriEvidencia;
        e.unidades = unidades;
        e.sobrecosto = sobrecosto;
        e.confirmacionesRequeridas = requeridas;
        // casting to uint8 is safe because nv <= MAX_VERIFICADORES (7)
        // forge-lint: disable-next-line(unsafe-typecast)
        e.rechazosRequeridos = uint8(nv - requeridas + 1);
        // Quórum de la comunidad, redondeado hacia arriba (30 % de 20 familias = 6).
        // casting to uint32 is safe because censo <= MAX_BENEFICIARIOS (1000)
        // forge-lint: disable-next-line(unsafe-typecast)
        e.beneficiariosRequeridos = uint32((censo * quorumBeneficiariosBps + BPS - 1) / BPS);
        e.estado = EstadoEtapa.Propuesta;
        e.bloquePropuesta = uint64(block.number);
        e.fechaPropuesta = uint64(block.timestamp);
        emit DesembolsoPropuesto(idEtapa, proveedor, e.monto, hashEvidencia, uriEvidencia, sobrecosto);

        if (sobrecosto) {
            reputacion.registrar(fundacion, IHistorialReputacion.Evento.Sobrecosto, 0);
            reputacion.registrar(proveedor, IHistorialReputacion.Evento.Sobrecosto, 0);
        }
    }

    /// @notice Un verificador confirma que la entrega ocurrió. Al llegar a las confirmaciones
    ///         requeridas (y al quórum de la comunidad) se paga automáticamente al proveedor.
    /// @param hashActa keccak256 del documento del acta (foto, fecha, ubicación).
    /// @param uriActa ipfs://<cid> de ese documento.
    /// @param unidadesContadas cuántas unidades vio el verificador en campo. Obligatorio si la
    ///        factura declaró unidades: si contó menos, la entrega está incompleta y el voto se
    ///        registra como rechazo (con el acta como motivo).
    function confirmarEntrega(
        uint256 idEtapa,
        bytes32 hashActa,
        string calldata uriActa,
        uint32 unidadesContadas
    ) external soloVerificador nonReentrant {
        Etapa storage e = _etapaVotable(idEtapa, hashActa);
        address v = _msgSender();
        uint32 facturadas = e.unidades;
        if (facturadas != 0 && unidadesContadas == 0) revert ConteoRequerido();
        unidadesContadasDe[idEtapa][v] = unidadesContadas;

        if (unidadesContadas < facturadas) {
            e.unidadesNoCuadran = true;
            emit UnidadesNoCuadran(idEtapa, v, facturadas, unidadesContadas);
            _registrarRechazo(idEtapa, e, v, hashActa, uriActa);
            return;
        }

        votoDe[idEtapa][v] = Voto.Confirma;
        evidenciaVotoDe[idEtapa][v] = hashActa;
        uriVotoDe[idEtapa][v] = uriActa;
        e.confirmaciones += 1;
        reputacion.registrar(v, IHistorialReputacion.Evento.Voto, 0);
        emit EntregaConfirmada(idEtapa, v, hashActa, uriActa, e.confirmaciones);

        if (e.confirmaciones >= e.confirmacionesRequeridas) {
            e.estado = EstadoEtapa.Aprobada;
            emit EtapaAprobada(idEtapa);
            _intentarLiberar(idEtapa, e);
        }
    }

    /// @notice Un verificador rechaza la etapa (la entrega no ocurrió o la evidencia no cuadra).
    ///         Si se alcanzan los rechazos necesarios, la campaña pasa a reembolso.
    function rechazarEtapa(uint256 idEtapa, bytes32 hashMotivo, string calldata uriMotivo)
        external
        soloVerificador
    {
        Etapa storage e = _etapaVotable(idEtapa, hashMotivo);
        _registrarRechazo(idEtapa, e, _msgSender(), hashMotivo, uriMotivo);
    }

    function _registrarRechazo(
        uint256 idEtapa,
        Etapa storage e,
        address v,
        bytes32 hashMotivo,
        string calldata uriMotivo
    ) private {
        votoDe[idEtapa][v] = Voto.Rechaza;
        evidenciaVotoDe[idEtapa][v] = hashMotivo;
        uriVotoDe[idEtapa][v] = uriMotivo;
        e.rechazos += 1;
        reputacion.registrar(v, IHistorialReputacion.Evento.Voto, 0);
        emit VotoRechazo(idEtapa, v, hashMotivo, uriMotivo, e.rechazos);

        if (e.rechazos >= e.rechazosRequeridos) {
            e.estado = EstadoEtapa.Rechazada;
            emit EtapaRechazada(idEtapa);
            reputacion.registrar(fundacion, IHistorialReputacion.Evento.EtapaRechazada, 0);
            reputacion.registrar(e.proveedor, IHistorialReputacion.Evento.EtapaRechazada, 0);
            _activarReembolso(MotivoReembolso.EtapaRechazada);
        }
    }

    function _etapaVotable(uint256 idEtapa, bytes32 hash) private view returns (Etapa storage e) {
        if (estado != EstadoCampana.EnEjecucion) revert EstadoInvalido();
        if (idEtapa != etapaActual) revert EtapaInvalida();
        e = _etapas[idEtapa];
        if (e.estado != EstadoEtapa.Propuesta) revert EstadoEtapaInvalido();
        if (block.timestamp > e.fechaLimite) revert PlazoVencido();
        if (hash == bytes32(0)) revert HashVacio();
        if (votoDe[idEtapa][_msgSender()] != Voto.Ninguno) revert YaVoto();
    }

    /// @dev Paga si ya están las dos señales: verificadores (estado Aprobada) y comunidad.
    function _intentarLiberar(uint256 idEtapa, Etapa storage e) private {
        if (e.estado == EstadoEtapa.Aprobada && e.confirmacionesBeneficiarios >= e.beneficiariosRequeridos)
        {
            _liberarFondos(idEtapa, e);
        }
    }

    function _liberarFondos(uint256 idEtapa, Etapa storage e) private {
        address proveedor = e.proveedor;
        // Si el proveedor fue dado de baja después de la propuesta, no se le paga.
        if (!registro.esProveedor(proveedor)) revert ProveedorNoAutorizado(proveedor);

        uint256 monto = e.monto;
        e.estado = EstadoEtapa.Pagada;
        e.bloquePago = uint64(block.number);
        e.fechaPago = uint64(block.timestamp);
        totalPagado += monto;

        uint256 siguiente = idEtapa + 1;
        etapaActual = siguiente;
        if (siguiente == _etapas.length) {
            estado = EstadoCampana.Finalizada;
        } else {
            _etapas[siguiente].fechaLimite = uint64(block.timestamp) + _etapas[siguiente].plazo;
        }

        token.safeTransfer(proveedor, monto);
        emit FondosLiberados(idEtapa, proveedor, monto);
        reputacion.registrar(fundacion, IHistorialReputacion.Evento.EtapaPagada, monto);
        reputacion.registrar(proveedor, IHistorialReputacion.Evento.EtapaPagada, monto);
        if (estado == EstadoCampana.Finalizada) {
            emit CampanaFinalizada(totalPagado);
            reputacion.registrar(fundacion, IHistorialReputacion.Evento.CampanaFinalizada, 0);
        }
    }

    // ───────────────────────────── Reembolsos ─────────────────────────────

    /// @notice Cualquiera puede activar el reembolso si la etapa actual venció sin pagarse.
    function activarReembolsoPorVencimiento() external {
        if (estado != EstadoCampana.EnEjecucion) revert EstadoInvalido();
        Etapa storage e = _etapas[etapaActual];
        if (block.timestamp <= e.fechaLimite) revert PlazoNoVencido();
        reputacion.registrar(fundacion, IHistorialReputacion.Evento.EtapaVencida, 0);
        if (e.proveedor != address(0)) {
            reputacion.registrar(e.proveedor, IHistorialReputacion.Evento.EtapaVencida, 0);
        }
        _activarReembolso(MotivoReembolso.PlazoVencido);
    }

    /// @notice La fundación puede cancelar la campaña; lo no pagado vuelve a los donantes.
    function cancelar() external soloFundacion nonReentrant {
        if (estado != EstadoCampana.Recaudando && estado != EstadoCampana.EnEjecucion) {
            revert EstadoInvalido();
        }
        _activarReembolso(MotivoReembolso.Cancelada);
    }

    function _activarReembolso(MotivoReembolso motivo) private {
        bool recaudando = estado == EstadoCampana.Recaudando;
        estado = EstadoCampana.Reembolso;
        motivoReembolso = motivo;
        fechaReembolso = uint64(block.timestamp);
        emit ReembolsoActivado(motivo, etapaActual);
        reputacion.registrar(fundacion, IHistorialReputacion.Evento.CampanaEnReembolso, 0);
        if (recaudando) _liquidarMatching();
    }

    /// @notice Devuelve al donante su parte proporcional de lo que no se ha pagado.
    function reclamarReembolso() external nonReentrant {
        address donante = _msgSender();
        uint256 monto = reembolsoDisponible(donante);
        if (monto == 0) revert NadaQueReclamar();
        montoReembolsado[donante] = monto;
        totalReembolsado += monto;
        token.safeTransfer(donante, monto);
        emit ReembolsoReclamado(donante, monto);
    }

    // ───────────────────────────── Lecturas ─────────────────────────────

    function reembolsoDisponible(address donante) public view returns (uint256) {
        if (estado != EstadoCampana.Reembolso) return 0;
        if (montoReembolsado[donante] != 0 || totalRecaudado == 0) return 0;
        return (aportes[donante] * (totalRecaudado - totalPagado)) / totalRecaudado;
    }

    /// @notice Parte de un donante en una etapa: aporte * montoEtapa / totalRecaudado.
    function parteDonanteEnEtapa(address donante, uint256 idEtapa) public view returns (uint256) {
        if (totalRecaudado == 0) return 0;
        return (aportes[donante] * _etapas[idEtapa].monto) / totalRecaudado;
    }

    /// @notice "A dónde fue cada peso" de un donante, en una sola llamada.
    function resumenDonante(address donante) external view returns (ResumenDonante memory r) {
        uint256 n = _etapas.length;
        r.aporte = aportes[donante];
        r.totalRecaudado = totalRecaudado;
        r.partePorEtapa = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            uint256 parte = parteDonanteEnEtapa(donante, i);
            r.partePorEtapa[i] = parte;
            if (_etapas[i].estado == EstadoEtapa.Pagada) r.pagadoAProveedores += parte;
        }
        r.reembolsable = reembolsoDisponible(donante);
        r.reembolsado = montoReembolsado[donante];
        uint256 usado = r.pagadoAProveedores + r.reembolsado;
        r.pendiente = r.aporte > usado ? r.aporte - usado : 0;
        // Si ya reclamó, lo que queda es solo polvo de redondeo: no se muestra como pendiente.
        if (r.reembolsado != 0) r.pendiente = 0;
        r.recibo = reciboDe[donante];
        r.matchingGenerado = matchingGenerado[donante];
    }

    function info() external view returns (InfoCampana memory i) {
        i.direccion = address(this);
        i.nombre = nombre;
        i.descripcion = descripcion;
        i.fundacion = fundacion;
        i.token = address(token);
        i.meta = meta;
        i.totalRecaudado = totalRecaudado;
        i.totalPagado = totalPagado;
        i.totalReembolsado = totalReembolsado;
        i.estado = estado;
        i.motivoReembolso = motivoReembolso;
        i.etapaActual = etapaActual;
        i.numeroEtapas = _etapas.length;
        i.numeroDonantes = _donantes.length;
        i.numeroDonaciones = _donaciones.length;
        i.fechaCierreRecaudo = fechaCierreRecaudo;
        i.bloqueCreacion = bloqueCreacion;
        i.umbral = umbral;
        i.rechazosParaRechazar = rechazosParaRechazar;
        i.verificadores = _verificadores;
        i.fechaCreacion = fechaCreacion;
        i.fechaRecaudoCerrado = fechaRecaudoCerrado;
        i.fechaReembolso = fechaReembolso;
        i.quorumBeneficiariosBps = quorumBeneficiariosBps;
        i.numeroBeneficiarios = _beneficiarios.length;
        i.matchingBloqueado = matchingBloqueado;
        i.matchingUsado = matchingUsado;
    }

    function etapas() external view returns (Etapa[] memory) {
        return _etapas;
    }

    function etapa(uint256 idEtapa) external view returns (Etapa memory) {
        return _etapas[idEtapa];
    }

    function numeroEtapas() external view returns (uint256) {
        return _etapas.length;
    }

    function verificadores() external view returns (address[] memory) {
        return _verificadores;
    }

    function matchings() external view returns (Matching[] memory) {
        return _matchings;
    }

    /// @notice Voto, hash y URI de la evidencia y unidades contadas de cada verificador (en el
    ///         orden de `verificadores()`).
    function votos(uint256 idEtapa)
        external
        view
        returns (
            Voto[] memory listaVotos,
            bytes32[] memory evidencias,
            string[] memory uris,
            uint32[] memory unidadesContadas
        )
    {
        uint256 n = _verificadores.length;
        listaVotos = new Voto[](n);
        evidencias = new bytes32[](n);
        uris = new string[](n);
        unidadesContadas = new uint32[](n);
        for (uint256 i = 0; i < n; i++) {
            address v = _verificadores[i];
            listaVotos[i] = votoDe[idEtapa][v];
            evidencias[i] = evidenciaVotoDe[idEtapa][v];
            uris[i] = uriVotoDe[idEtapa][v];
            unidadesContadas[i] = unidadesContadasDe[idEtapa][v];
        }
    }

    function numeroBeneficiarios() external view returns (uint256) {
        return _beneficiarios.length;
    }

    /// @notice Página del censo, con si cada familia confirmó la etapa `idEtapa`.
    function beneficiarios(uint256 idEtapa, uint256 desde, uint256 cantidad)
        external
        view
        returns (address[] memory cuentas, bool[] memory confirmo)
    {
        (uint256 inicio, uint256 fin) = _rango(desde, cantidad, _beneficiarios.length);
        uint256 len = fin - inicio;
        cuentas = new address[](len);
        confirmo = new bool[](len);
        for (uint256 i = 0; i < len; i++) {
            address b = _beneficiarios[inicio + i];
            cuentas[i] = b;
            confirmo[i] = recepcionDe[idEtapa][b];
        }
    }

    function numeroDonantes() external view returns (uint256) {
        return _donantes.length;
    }

    function numeroDonaciones() external view returns (uint256) {
        return _donaciones.length;
    }

    /// @notice Página de donantes con su aporte.
    function donantes(uint256 desde, uint256 cantidad)
        external
        view
        returns (address[] memory cuentas, uint256[] memory montos)
    {
        (uint256 inicio, uint256 fin) = _rango(desde, cantidad, _donantes.length);
        uint256 len = fin - inicio;
        cuentas = new address[](len);
        montos = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            address d = _donantes[inicio + i];
            cuentas[i] = d;
            montos[i] = aportes[d];
        }
    }

    /// @notice Página del historial de donaciones (en orden de llegada; incluye el matching).
    function donaciones(uint256 desde, uint256 cantidad) external view returns (RegistroDonacion[] memory lista) {
        (uint256 inicio, uint256 fin) = _rango(desde, cantidad, _donaciones.length);
        lista = new RegistroDonacion[](fin - inicio);
        for (uint256 i = inicio; i < fin; i++) {
            lista[i - inicio] = _donaciones[i];
        }
    }

    function _rango(uint256 desde, uint256 cantidad, uint256 total)
        private
        pure
        returns (uint256 inicio, uint256 fin)
    {
        inicio = desde > total ? total : desde;
        fin = cantidad > total - inicio ? total : inicio + cantidad;
    }
}
