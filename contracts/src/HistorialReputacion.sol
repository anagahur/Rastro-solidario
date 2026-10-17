// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Lo que las campañas reportan al historial. Una sola función para que cada reporte
///         cueste una llamada externa y nada más.
interface IHistorialReputacion {
    enum Evento {
        CampanaCreada, // fundación: abrió una campaña
        CampanaFinalizada, // fundación: todas las etapas se pagaron
        CampanaEnReembolso, // fundación: la campaña terminó devolviendo dinero
        EtapaPagada, // fundación y proveedor (monto = lo pagado)
        EtapaRechazada, // fundación y proveedor: los verificadores dijeron que no
        EtapaVencida, // fundación y proveedor: nadie la aprobó a tiempo
        Sobrecosto, // fundación y proveedor: factura por encima del precio de referencia
        Voto, // verificador: votó en una etapa
        MatchingLiquidado // empresa: cuánto de su matching terminó en la campaña (monto)
    }

    function registrar(address actor, Evento evento, uint256 monto) external;
}

interface ICampanaFactoryReputacion {
    function esCampana(address campana) external view returns (bool);
}

/// @title HistorialReputacion
/// @notice Historial público e inalterable de cada actor, acumulado entre todas las campañas.
///         Nadie lo escribe a mano: solo las campañas oficiales (creadas por la factory) reportan
///         lo que de verdad pasó con el dinero. Sirve para decidir a quién donarle en la
///         próxima emergencia, y cualquier otro contrato lo puede consultar.
contract HistorialReputacion is IHistorialReputacion, Ownable {
    uint16 public constant BPS = 10_000;

    struct Historial {
        uint32 campanas; // fundación: creadas · empresa: apoyadas con matching
        uint32 finalizadas;
        uint32 enReembolso;
        uint32 etapasPagadas;
        uint32 etapasRechazadas;
        uint32 etapasVencidas;
        uint32 sobrecostos;
        uint32 votos;
        uint64 ultimaActividad;
        uint256 monto; // fundación: ejecutado · proveedor: recibido · empresa: aportado
    }

    ICampanaFactoryReputacion public factory;
    mapping(address => Historial) private _historial;

    event EventoRegistrado(
        address indexed actor, address indexed origen, Evento evento, uint256 monto
    );

    error FactoryYaConfigurada();
    error SoloSistema();

    constructor(address owner_) Ownable(owner_) { }

    /// @notice Se configura una única vez (la factory necesita esta dirección y viceversa).
    function configurarFactory(ICampanaFactoryReputacion factory_) external onlyOwner {
        if (address(factory) != address(0)) revert FactoryYaConfigurada();
        factory = factory_;
    }

    function registrar(address actor, Evento evento, uint256 monto) external {
        if (msg.sender != address(factory) && !factory.esCampana(msg.sender)) revert SoloSistema();
        Historial storage h = _historial[actor];
        if (evento == Evento.CampanaCreada) {
            h.campanas += 1;
        } else if (evento == Evento.CampanaFinalizada) {
            h.finalizadas += 1;
        } else if (evento == Evento.CampanaEnReembolso) {
            h.enReembolso += 1;
        } else if (evento == Evento.EtapaPagada) {
            h.etapasPagadas += 1;
            h.monto += monto;
        } else if (evento == Evento.EtapaRechazada) {
            h.etapasRechazadas += 1;
        } else if (evento == Evento.EtapaVencida) {
            h.etapasVencidas += 1;
        } else if (evento == Evento.Sobrecosto) {
            h.sobrecostos += 1;
        } else if (evento == Evento.Voto) {
            h.votos += 1;
        } else {
            h.campanas += 1;
            h.monto += monto;
        }
        h.ultimaActividad = uint64(block.timestamp);
        emit EventoRegistrado(actor, msg.sender, evento, monto);
    }

    function historial(address actor) external view returns (Historial memory) {
        return _historial[actor];
    }

    function historiales(address[] calldata actores) external view returns (Historial[] memory r) {
        r = new Historial[](actores.length);
        for (uint256 i = 0; i < actores.length; i++) {
            r[i] = _historial[actores[i]];
        }
    }

    /// @notice Índice de confianza en puntos básicos (10000 = 100 %):
    ///         etapas pagadas / (pagadas + rechazadas + vencidas + sobrecostos).
    ///         Un sobrecosto cuenta en contra aunque después se haya aprobado.
    /// @return bps índice (0 si no hay historial) · evaluadas cuántos hechos lo respaldan
    function indiceConfianza(address actor) external view returns (uint16 bps, uint32 evaluadas) {
        Historial storage h = _historial[actor];
        evaluadas = h.etapasPagadas + h.etapasRechazadas + h.etapasVencidas + h.sobrecostos;
        if (evaluadas == 0) return (0, 0);
        // casting to uint16 is safe because the ratio is <= BPS (10000)
        // forge-lint: disable-next-line(unsafe-typecast)
        bps = uint16((uint256(h.etapasPagadas) * BPS) / evaluadas);
    }
}
