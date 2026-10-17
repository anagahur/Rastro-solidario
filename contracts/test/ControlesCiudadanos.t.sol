// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { BaseTest } from "./utils/BaseTest.sol";
import { CampanaEmergencia } from "../src/CampanaEmergencia.sol";
import {
    HistorialReputacion,
    IHistorialReputacion,
    ICampanaFactoryReputacion
} from "../src/HistorialReputacion.sol";
import { ERC2771Forwarder } from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/// @notice Lo que va más allá del flujo básico: la voz de la comunidad (censo + QR), el gas
///         patrocinado (ERC-2771), la alerta de sobrecosto, el matching de empresas y la
///         reputación acumulada entre campañas.
contract ControlesCiudadanosTest is BaseTest {
    uint256 internal constant PRECIO_MERCADO = 150_000 ether; // referencia por mercado familiar
    uint256 internal constant PRECIO_KIT = 400_000 ether; // referencia por kit de techo

    bytes32 internal constant FORWARD_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
    );
    bytes32 internal constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

    address internal patrocinador = makeAddr("patrocinador");

    // ═══════════════════════ Helpers ═══════════════════════

    /// @dev Campaña con censo obligatorio (30 %) y precios de referencia en las dos primeras etapas.
    function _configCompleta() internal view returns (CampanaEmergencia.ConfigCampana memory cfg) {
        cfg = _config();
        cfg.quorumBeneficiariosBps = 3000;
        cfg.preciosReferencia = new uint256[](3);
        cfg.preciosReferencia[0] = PRECIO_MERCADO;
        cfg.preciosReferencia[1] = PRECIO_KIT;
        cfg.unidadesReferencia = new string[](3);
        cfg.unidadesReferencia[0] = "mercado familiar";
        cfg.unidadesReferencia[1] = "kit de techo";
    }

    function _llaveBeneficiario(uint256 i) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode("beneficiario", i)));
    }

    function _censo(CampanaEmergencia c, uint256 n) internal returns (address[] memory bs) {
        bs = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            bs[i] = vm.addr(_llaveBeneficiario(i));
        }
        vm.prank(verificador2); // la Junta de Acción Comunal conoce a las familias
        c.registrarBeneficiarios(bs);
    }

    function _proponerUnidades(CampanaEmergencia c, uint256 id, address prov, uint32 unidades) internal {
        vm.prank(fundacion);
        c.proponerDesembolso(id, prov, FACTURA, "ipfs://bafyfactura", unidades);
    }

    function _confirmanFamilias(CampanaEmergencia c, uint256 id, address[] memory bs, uint256 desde, uint256 hasta)
        internal
    {
        for (uint256 i = desde; i < hasta; i++) {
            vm.prank(bs[i]);
            c.confirmarRecepcion(id);
        }
    }

    function _firmarReenvio(uint256 llave, address to, bytes memory data, uint256 gas)
        internal
        view
        returns (ERC2771Forwarder.ForwardRequestData memory req)
    {
        address from = vm.addr(llave);
        uint48 deadline = uint48(block.timestamp + 1 hours);
        bytes32 structHash = keccak256(
            abi.encode(
                FORWARD_TYPEHASH, from, to, uint256(0), gas, reenviador.nonces(from), deadline, keccak256(data)
            )
        );
        bytes32 dominio = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("Rastro Solidario"),
                keccak256("1"),
                block.chainid,
                address(reenviador)
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(llave, keccak256(abi.encodePacked("\x19\x01", dominio, structHash)));
        req = ERC2771Forwarder.ForwardRequestData({
            from: from,
            to: to,
            value: 0,
            gas: gas,
            deadline: deadline,
            data: data,
            signature: abi.encodePacked(r, s, v)
        });
    }

    function _firmarPermit(uint256 llave, address spender, uint256 monto, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        address owner = vm.addr(llave);
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, monto, cop.nonces(owner), deadline));
        (v, r, s) = vm.sign(llave, keccak256(abi.encodePacked("\x19\x01", cop.DOMAIN_SEPARATOR(), structHash)));
    }

    function _comprometer(CampanaEmergencia c, address quien, uint16 bps, uint256 tope) internal {
        _fondear(quien, tope);
        vm.startPrank(quien);
        cop.approve(address(c), tope);
        c.comprometerMatching(bps, tope);
        vm.stopPrank();
    }

    function _saldoCuadra(CampanaEmergencia c) internal view {
        assertEq(
            cop.balanceOf(address(c)),
            c.totalRecaudado() - c.totalPagado() - c.totalReembolsado() + c.matchingBloqueado(),
            "el saldo cuadra"
        );
    }

    // ═══════════════════════ Voz de la comunidad ═══════════════════════

    function test_Comunidad_PagoEsperaElQuorumDeFamilias() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = _censo(c, 10);
        _donar(c, makeAddr("d"), META);

        _proponerUnidades(c, 0, supermercado, 20); // 3.000.000 / 20 = 150.000: sin sobrecosto
        CampanaEmergencia.Etapa memory e = c.etapa(0);
        assertEq(e.beneficiariosRequeridos, 3, "30 % de 10 familias");
        assertEq(e.confirmacionesRequeridas, 2);

        _aprobar(c, 0);
        e = c.etapa(0);
        assertEq(uint256(e.estado), uint256(CampanaEmergencia.EstadoEtapa.Aprobada), "aprobada, sin pagar");
        assertEq(cop.balanceOf(supermercado), 0, "los verificadores solos no bastan");

        _confirmanFamilias(c, 0, bs, 0, 2);
        assertEq(cop.balanceOf(supermercado), 0, "2 de 3 familias no bastan");

        vm.prank(bs[2]);
        c.confirmarRecepcion(0);
        assertEq(cop.balanceOf(supermercado), 3_000_000 ether, "la tercera familia libera el pago");
        assertEq(uint256(c.etapa(0).estado), uint256(CampanaEmergencia.EstadoEtapa.Pagada));
        assertEq(c.etapaActual(), 1);
        assertTrue(c.recepcionDe(0, bs[0]));
        assertFalse(c.recepcionDe(0, bs[5]));
    }

    function test_Comunidad_FamiliasAntesQueVerificadores() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 20);

        _confirmanFamilias(c, 0, bs, 0, 4);
        assertEq(cop.balanceOf(supermercado), 0);
        _aprobar(c, 0); // la 2.ª confirmación de verificador paga en la misma transacción
        assertEq(cop.balanceOf(supermercado), 3_000_000 ether);
    }

    function test_Comunidad_ConsultaDelCenso() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = _censo(c, 5);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 20);
        vm.prank(bs[1]);
        c.confirmarRecepcion(0);

        (address[] memory cuentas, bool[] memory confirmo) = c.beneficiarios(0, 0, 10);
        assertEq(cuentas.length, 5);
        assertEq(cuentas[1], bs[1]);
        assertTrue(confirmo[1]);
        assertFalse(confirmo[0]);
        assertEq(c.info().numeroBeneficiarios, 5);
    }

    function test_RevertSi_FundacionCargaElCenso() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = new address[](1);
        bs[0] = makeAddr("familiaInventada");
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.SoloVerificador.selector);
        c.registrarBeneficiarios(bs);
    }

    function test_RevertSi_BeneficiarioInvalido() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = new address[](1);
        address[4] memory malos = [fundacion, verificador1, supermercado, address(0)];
        for (uint256 i = 0; i < malos.length; i++) {
            bs[0] = malos[i];
            vm.prank(verificador2);
            vm.expectRevert(abi.encodeWithSelector(CampanaEmergencia.BeneficiarioInvalido.selector, malos[i]));
            c.registrarBeneficiarios(bs);
        }
        // Repetido
        _censo(c, 1);
        bs[0] = vm.addr(_llaveBeneficiario(0));
        vm.prank(verificador2);
        vm.expectRevert(abi.encodeWithSelector(CampanaEmergencia.BeneficiarioInvalido.selector, bs[0]));
        c.registrarBeneficiarios(bs);
    }

    function test_RevertSi_ProponerSinCenso() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        _donar(c, makeAddr("d"), META);
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.SinCenso.selector);
        c.proponerDesembolso(0, supermercado, FACTURA, "", 20);
    }

    function test_RevertSi_ConfirmacionDeFamiliaInvalida() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = _censo(c, 3);
        _donar(c, makeAddr("d"), META);

        vm.prank(bs[0]);
        vm.expectRevert(CampanaEmergencia.EstadoEtapaInvalido.selector); // aún no hay propuesta
        c.confirmarRecepcion(0);

        _proponerUnidades(c, 0, supermercado, 20);
        vm.prank(intruso);
        vm.expectRevert(CampanaEmergencia.NoEsBeneficiario.selector);
        c.confirmarRecepcion(0);

        vm.prank(bs[0]);
        vm.expectRevert(CampanaEmergencia.EtapaInvalida.selector);
        c.confirmarRecepcion(1);

        vm.prank(bs[0]);
        c.confirmarRecepcion(0);
        vm.prank(bs[0]);
        vm.expectRevert(CampanaEmergencia.YaConfirmo.selector);
        c.confirmarRecepcion(0);
    }

    function test_Comunidad_SiNoConfirmanATiempoSeReembolsa() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        _censo(c, 10);
        address d = makeAddr("d");
        _donar(c, d, META);
        _proponerUnidades(c, 0, supermercado, 20);
        _aprobar(c, 0); // aprobada por verificadores, pero ninguna familia confirma

        vm.warp(block.timestamp + 3 days + 1);
        c.activarReembolsoPorVencimiento();
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.Reembolso));
        vm.prank(d);
        c.reclamarReembolso();
        assertEq(cop.balanceOf(d), META, "recupera todo");
        assertEq(reputacion.historial(supermercado).etapasVencidas, 1);
        assertEq(reputacion.historial(fundacion).etapasVencidas, 1);
    }

    // ═══════════════════════ Gas patrocinado (ERC-2771) ═══════════════════════

    function test_Reenvio_FamiliaConfirmaSinGas() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 20);

        ERC2771Forwarder.ForwardRequestData memory req = _firmarReenvio(
            _llaveBeneficiario(0), address(c), abi.encodeCall(c.confirmarRecepcion, (0)), 300_000
        );
        assertEq(bs[0].balance, 0, "la familia no tiene gas");
        vm.prank(patrocinador);
        reenviador.execute(req);
        assertTrue(c.recepcionDe(0, bs[0]), "cuenta como la familia, no como el patrocinador");
        assertEq(c.etapa(0).confirmacionesBeneficiarios, 1);
    }

    function test_Reenvio_DonacionSinCriptoConPermit() public {
        CampanaEmergencia c = _crearCampana();
        uint256 llave = uint256(keccak256("billetera invisible"));
        address donante = vm.addr(llave);
        _fondear(donante, 50_000 ether); // la pasarela (Nequi/PSE simulado) acuña los MockCOP

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _firmarPermit(llave, address(c), 50_000 ether, deadline);
        bytes memory data = abi.encodeCall(c.donarConPermit, (50_000 ether, deadline, v, r, s));
        ERC2771Forwarder.ForwardRequestData memory req = _firmarReenvio(llave, address(c), data, 800_000);

        vm.prank(patrocinador);
        reenviador.execute(req);
        assertEq(c.aportes(donante), 50_000 ether);
        assertEq(c.aportes(patrocinador), 0);
        assertEq(c.reciboDe(donante), 1, "el NFT de recibo es del donante");
        assertEq(donante.balance, 0);
    }

    function test_RevertSi_ElPatrocinadorAlteraLoFirmado() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 20);

        ERC2771Forwarder.ForwardRequestData memory req = _firmarReenvio(
            _llaveBeneficiario(0), address(c), abi.encodeCall(c.confirmarRecepcion, (0)), 300_000
        );
        req.data = abi.encodeCall(c.confirmarRecepcion, (1)); // otra etapa
        vm.prank(patrocinador);
        vm.expectRevert();
        reenviador.execute(req);
    }

    function test_Reenvio_LaCampanaConfiaEnElReenviador() public {
        CampanaEmergencia c = _crearCampana();
        assertTrue(c.isTrustedForwarder(address(reenviador)));
        assertEq(c.trustedForwarder(), address(reenviador));
    }

    // ═══════════════════════ Alerta de sobrecosto ═══════════════════════

    function test_Sobrecosto_PrecioJustoNoMarca() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 19); // 157.894 por mercado: dentro del 10 %
        CampanaEmergencia.Etapa memory e = c.etapa(0);
        assertFalse(e.sobrecosto);
        assertEq(e.confirmacionesRequeridas, 2);
        assertEq(e.unidades, 19);
        assertEq(e.uriEvidencia, "ipfs://bafyfactura");
    }

    function test_Sobrecosto_ExigeUnVerificadorMas() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 20);
        _aprobar(c, 0);
        _confirmanFamilias(c, 0, bs, 0, 3);

        // Etapa 2: 4.000.000 por 8 kits = 500.000 c/u contra 400.000 de referencia (+25 %).
        _proponerUnidades(c, 1, ferreteria, 8);
        CampanaEmergencia.Etapa memory e = c.etapa(1);
        assertTrue(e.sobrecosto);
        assertEq(e.confirmacionesRequeridas, 3, "3 de 3");
        assertEq(e.rechazosRequeridos, 1, "un solo rechazo la tumba");

        _confirmanFamilias(c, 1, bs, 0, 3);
        _aprobar(c, 1);
        assertEq(cop.balanceOf(ferreteria), 0, "2 de 3 ya no bastan");
        vm.prank(verificador3);
        c.confirmarEntrega(1, ACTA, "", 8);
        assertEq(cop.balanceOf(ferreteria), 4_000_000 ether);

        HistorialReputacion.Historial memory hf = reputacion.historial(ferreteria);
        assertEq(hf.sobrecostos, 1);
        assertEq(hf.etapasPagadas, 1);
        assertEq(reputacion.historial(fundacion).sobrecostos, 1);
        (uint16 indice,) = reputacion.indiceConfianza(ferreteria);
        assertEq(indice, 5000, "el sobrecosto pesa aunque se haya aprobado");
    }

    function test_Sobrecosto_UnSoloRechazoBasta() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 10); // 300.000 por mercado: el doble
        assertTrue(c.etapa(0).sobrecosto);
        vm.prank(verificador1);
        c.rechazarEtapa(0, MOTIVO, "ipfs://motivo");
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.Reembolso));
    }

    function test_Sobrecosto_SinMargenSiElUmbralYaEsTotal() public {
        CampanaEmergencia.ConfigCampana memory cfg = _configCompleta();
        cfg.umbral = 3; // 3 de 3: no hay un verificador más que pedir
        CampanaEmergencia c = _crearCampana(cfg);
        _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 10);
        assertTrue(c.etapa(0).sobrecosto);
        assertEq(c.etapa(0).confirmacionesRequeridas, 3);
    }

    function test_RevertSi_FaltanUnidadesConPrecioDeReferencia() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.UnidadesRequeridas.selector);
        c.proponerDesembolso(0, supermercado, FACTURA, "", 0);
    }

    // ═══════════════════════ Conteo en campo ═══════════════════════

    function test_Conteo_SeGuardaLoQueContoCadaVerificador() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 20);
        vm.prank(verificador1);
        c.confirmarEntrega(0, ACTA, "", 20);
        vm.prank(verificador2);
        c.confirmarEntrega(0, ACTA, "", 21); // entregaron de más: no es problema
        _confirmanFamilias(c, 0, bs, 0, 3);

        assertEq(cop.balanceOf(supermercado), 3_000_000 ether);
        assertFalse(c.etapa(0).unidadesNoCuadran);
        (,,, uint32[] memory contadas) = c.votos(0);
        assertEq(contadas[0], 20);
        assertEq(contadas[1], 21);
        assertEq(contadas[2], 0, "el verificador 3 no voto");
    }

    function test_Conteo_MenosUnidadesCuentaComoRechazo() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 20);

        vm.expectEmit(true, true, false, true, address(c));
        emit CampanaEmergencia.UnidadesNoCuadran(0, verificador1, 20, 15);
        vm.prank(verificador1);
        c.confirmarEntrega(0, ACTA, "ipfs://acta", 15);

        CampanaEmergencia.Etapa memory e = c.etapa(0);
        assertTrue(e.unidadesNoCuadran);
        assertEq(e.confirmaciones, 0);
        assertEq(e.rechazos, 1);
        assertEq(uint256(c.votoDe(0, verificador1)), uint256(CampanaEmergencia.Voto.Rechaza));
        assertEq(c.uriVotoDe(0, verificador1), "ipfs://acta", "el acta queda como motivo");

        vm.prank(verificador3);
        c.confirmarEntrega(0, ACTA, "", 12);
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.Reembolso));
        assertEq(cop.balanceOf(supermercado), 0);
        assertEq(reputacion.historial(supermercado).etapasRechazadas, 1);
    }

    function test_Conteo_UnSoloConteoBajoNoFrenaElPago() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        address[] memory bs = _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 20);
        _confirmanFamilias(c, 0, bs, 0, 3);

        vm.prank(verificador1);
        c.confirmarEntrega(0, ACTA, "", 15);
        _aprobarCon(c, 0, verificador2, 20);
        _aprobarCon(c, 0, verificador3, 20);

        // 2 de 3 contaron completo: se paga, pero la diferencia queda pública.
        assertEq(cop.balanceOf(supermercado), 3_000_000 ether);
        assertTrue(c.etapa(0).unidadesNoCuadran);
        assertEq(reputacion.historial(supermercado).etapasRechazadas, 0);
    }

    function test_RevertSi_ConfirmaSinContar() public {
        CampanaEmergencia c = _crearCampana(_configCompleta());
        _censo(c, 10);
        _donar(c, makeAddr("d"), META);
        _proponerUnidades(c, 0, supermercado, 20);
        vm.prank(verificador1);
        vm.expectRevert(CampanaEmergencia.ConteoRequerido.selector);
        c.confirmarEntrega(0, ACTA, "", 0);
    }

    function _aprobarCon(CampanaEmergencia c, uint256 id, address v, uint32 contadas) internal {
        vm.prank(v);
        c.confirmarEntrega(id, ACTA, "", contadas);
    }

    function test_RevertSi_PreciosDeReferenciaMalConfigurados() public {
        CampanaEmergencia.ConfigCampana memory cfg = _configCompleta();
        cfg.unidadesReferencia = new string[](2);
        vm.prank(fundacion);
        vm.expectRevert(
            abi.encodeWithSelector(CampanaEmergencia.ConfigInvalida.selector, "precios de referencia")
        );
        factory.crearCampana(cfg);

        cfg = _configCompleta();
        cfg.unidadesReferencia[0] = "";
        vm.prank(fundacion);
        vm.expectRevert(abi.encodeWithSelector(CampanaEmergencia.ConfigInvalida.selector, "unidad"));
        factory.crearCampana(cfg);

        cfg = _configCompleta();
        cfg.quorumBeneficiariosBps = 10_001;
        vm.prank(fundacion);
        vm.expectRevert(
            abi.encodeWithSelector(CampanaEmergencia.ConfigInvalida.selector, "quorum beneficiarios")
        );
        factory.crearCampana(cfg);
    }

    // ═══════════════════════ Matching de empresas ═══════════════════════

    function test_Matching_DuplicaCadaDonacionHastaElTope() public {
        CampanaEmergencia c = _crearCampana();
        _comprometer(c, empresa, 10_000, 1_000_000 ether);
        assertEq(c.matchingBloqueado(), 1_000_000 ether);

        address d1 = makeAddr("d1");
        address d2 = makeAddr("d2");
        _donar(c, d1, 300_000 ether);
        assertEq(c.aportes(empresa), 300_000 ether);
        assertEq(c.totalRecaudado(), 600_000 ether);
        assertEq(c.matchingGenerado(d1), 300_000 ether);

        _donar(c, d2, 1_000_000 ether); // solo quedan 700.000 de matching
        assertEq(c.matchingGenerado(d2), 700_000 ether);
        assertEq(c.aportes(empresa), 1_000_000 ether);
        assertEq(c.matchingBloqueado(), 0);
        assertEq(c.matchingUsado(), 1_000_000 ether);
        assertEq(c.totalRecaudado(), 2_300_000 ether);
        assertEq(c.resumenDonante(d2).matchingGenerado, 700_000 ether);
        _saldoCuadra(c);
    }

    function test_Matching_SobranteVuelveALaEmpresaAlCerrar() public {
        CampanaEmergencia c = _crearCampana();
        _comprometer(c, empresa, 5000, 2_000_000 ether); // suma el 50 %
        _donar(c, makeAddr("d"), 1_000_000 ether);
        assertEq(c.aportes(empresa), 500_000 ether);

        vm.prank(fundacion);
        c.cerrarRecaudo();
        assertEq(cop.balanceOf(empresa), 1_500_000 ether, "recupera lo no usado");
        assertEq(c.matchingBloqueado(), 0);
        _saldoCuadra(c);
        HistorialReputacion.Historial memory h = reputacion.historial(empresa);
        assertEq(h.campanas, 1);
        assertEq(h.monto, 500_000 ether);
        assertEq(c.matchings()[0].tope, 500_000 ether);
    }

    function test_Matching_RespetaLaMetaYLaCierra() public {
        CampanaEmergencia c = _crearCampana();
        _comprometer(c, empresa, 10_000, 2_000_000 ether);
        _donar(c, makeAddr("grande"), META - 1_000_000 ether); // faltan 1.000.000: el matching los cubre
        assertEq(c.totalRecaudado(), META);
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.EnEjecucion));
        assertEq(c.aportes(empresa), 1_000_000 ether);
        assertEq(cop.balanceOf(empresa), 1_000_000 ether, "el resto vuelve al cerrar");
        _saldoCuadra(c);
    }

    function test_Matching_VariasEmpresasSeSuman() public {
        CampanaEmergencia c = _crearCampana();
        _comprometer(c, empresa, 10_000, 1_000_000 ether);
        _comprometer(c, empresa2, 5000, 1_000_000 ether);
        address d = makeAddr("d");
        _donar(c, d, 100_000 ether);
        assertEq(c.matchingGenerado(d), 150_000 ether, "100 % + 50 %");
        assertEq(c.totalRecaudado(), 250_000 ether);
        _saldoCuadra(c);
    }

    function test_Matching_CancelacionDevuelveTodoAlFinal() public {
        CampanaEmergencia c = _crearCampana();
        _comprometer(c, empresa, 10_000, 1_000_000 ether);
        address d = makeAddr("d");
        _donar(c, d, 200_000 ether);
        vm.prank(fundacion);
        c.cancelar();
        assertEq(cop.balanceOf(empresa), 800_000 ether, "lo no usado vuelve de inmediato");
        vm.prank(empresa);
        c.reclamarReembolso();
        vm.prank(d);
        c.reclamarReembolso();
        assertEq(cop.balanceOf(empresa), 1_000_000 ether);
        assertEq(cop.balanceOf(d), 200_000 ether);
        assertEq(cop.balanceOf(address(c)), 0);
    }

    function test_RevertSi_MatchingInvalido() public {
        CampanaEmergencia c = _crearCampana();
        _fondear(intruso, 1000 ether);
        vm.startPrank(intruso);
        cop.approve(address(c), 1000 ether);
        vm.expectRevert(CampanaEmergencia.SoloEmpresa.selector);
        c.comprometerMatching(10_000, 1000 ether);
        vm.stopPrank();

        vm.startPrank(empresa);
        vm.expectRevert(CampanaEmergencia.MatchingInvalido.selector);
        c.comprometerMatching(0, 1000 ether);
        vm.expectRevert(CampanaEmergencia.MatchingInvalido.selector);
        c.comprometerMatching(30_001, 1000 ether);
        vm.expectRevert(CampanaEmergencia.MatchingInvalido.selector);
        c.comprometerMatching(10_000, META + 1);
        vm.stopPrank();

        _comprometer(c, empresa, 10_000, 1000 ether);
        _fondear(empresa, 1000 ether);
        vm.startPrank(empresa);
        cop.approve(address(c), 1000 ether);
        vm.expectRevert(CampanaEmergencia.MatchingDuplicado.selector);
        c.comprometerMatching(10_000, 1000 ether);
        vm.stopPrank();
    }

    function test_RevertSi_MasDeTresEmpresas() public {
        CampanaEmergencia c = _crearCampana();
        for (uint256 i = 0; i < 4; i++) {
            address e = makeAddr(string.concat("empresa", vm.toString(i)));
            registro.registrarActor(registro.EMPRESA_ROLE(), e, "Empresa");
            if (i == 3) {
                _fondear(e, 1000 ether);
                vm.startPrank(e);
                cop.approve(address(c), 1000 ether);
                vm.expectRevert(CampanaEmergencia.DemasiadosMatchings.selector);
                c.comprometerMatching(10_000, 1000 ether);
                vm.stopPrank();
            } else {
                _comprometer(c, e, 10_000, 1000 ether);
            }
        }
    }

    function test_RevertSi_EmpresaAliadaEsElProveedor() public {
        CampanaEmergencia c = _crearCampana();
        registro.registrarActor(registro.PROVEEDOR_ROLE(), empresa, "Empresa que tambien vende");
        _comprometer(c, empresa, 10_000, 1000 ether);
        _donar(c, makeAddr("d"), META - 2000 ether);
        vm.prank(fundacion);
        c.cerrarRecaudo();
        vm.prank(fundacion);
        vm.expectRevert(abi.encodeWithSelector(CampanaEmergencia.ConflictoDeInteres.selector, empresa));
        c.proponerDesembolso(0, empresa, FACTURA, "", 0);
    }

    // ═══════════════════════ Reputación entre campañas ═══════════════════════

    function test_Reputacion_SeAcumulaEntreCampanas() public {
        // Campaña 1: todo se paga.
        CampanaEmergencia c1 = _crearCampana();
        _donar(c1, makeAddr("d1"), META);
        _proponer(c1, 0, supermercado);
        _aprobar(c1, 0);
        _proponer(c1, 1, ferreteria);
        _aprobar(c1, 1);
        _proponer(c1, 2, constructora);
        _aprobar(c1, 2);

        // Campaña 2: la ferretería no entrega y la etapa se rechaza.
        CampanaEmergencia c2 = _crearCampana();
        _donar(c2, makeAddr("d2"), META);
        _proponer(c2, 0, ferreteria);
        _rechazar(c2, 0);

        HistorialReputacion.Historial memory hf = reputacion.historial(fundacion);
        assertEq(hf.campanas, 2);
        assertEq(hf.finalizadas, 1);
        assertEq(hf.enReembolso, 1);
        assertEq(hf.etapasPagadas, 3);
        assertEq(hf.etapasRechazadas, 1);
        assertEq(hf.monto, META, "ejecutado a traves de proveedores");

        HistorialReputacion.Historial memory hp = reputacion.historial(ferreteria);
        assertEq(hp.etapasPagadas, 1);
        assertEq(hp.etapasRechazadas, 1);
        assertEq(hp.monto, 4_000_000 ether);
        (uint16 indice, uint32 evaluadas) = reputacion.indiceConfianza(ferreteria);
        assertEq(indice, 5000);
        assertEq(evaluadas, 2);
        (indice,) = reputacion.indiceConfianza(supermercado);
        assertEq(indice, 10_000);

        assertEq(reputacion.historial(verificador1).votos, 4);
        assertEq(reputacion.historial(verificador3).votos, 1);

        address[] memory actores = new address[](2);
        actores[0] = supermercado;
        actores[1] = constructora;
        HistorialReputacion.Historial[] memory lista = reputacion.historiales(actores);
        assertEq(lista[1].monto, 3_000_000 ether);
    }

    function test_Reputacion_SinHistorial() public view {
        (uint16 indice, uint32 evaluadas) = reputacion.indiceConfianza(intruso);
        assertEq(indice, 0);
        assertEq(evaluadas, 0);
    }

    function test_RevertSi_AlguienEscribeLaReputacionAMano() public {
        vm.prank(intruso);
        vm.expectRevert(HistorialReputacion.SoloSistema.selector);
        reputacion.registrar(intruso, IHistorialReputacion.Evento.EtapaPagada, 1 ether);

        vm.expectRevert(HistorialReputacion.FactoryYaConfigurada.selector);
        reputacion.configurarFactory(ICampanaFactoryReputacion(intruso));
    }

    // ═══════════════════════ Línea de tiempo ═══════════════════════

    function test_FechasParaLaLineaDeTiempo() public {
        CampanaEmergencia c = _crearCampana();
        uint256 t0 = block.timestamp;
        vm.warp(t0 + 1 hours);
        _donar(c, makeAddr("d"), META);
        vm.warp(t0 + 2 hours);
        _proponer(c, 0, supermercado);
        vm.warp(t0 + 3 hours);
        _aprobar(c, 0);

        CampanaEmergencia.InfoCampana memory i = c.info();
        assertEq(i.fechaCreacion, t0);
        assertEq(i.fechaRecaudoCerrado, t0 + 1 hours);
        CampanaEmergencia.Etapa memory e = c.etapa(0);
        assertEq(e.fechaPropuesta, t0 + 2 hours);
        assertEq(e.fechaPago, t0 + 3 hours);
    }
}
