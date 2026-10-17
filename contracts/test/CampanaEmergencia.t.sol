// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { BaseTest } from "./utils/BaseTest.sol";
import { CampanaEmergencia } from "../src/CampanaEmergencia.sol";

contract CampanaEmergenciaTest is BaseTest {
    CampanaEmergencia internal c;

    event Donacion(address indexed donante, uint256 monto, uint256 aporteTotal, uint256 totalRecaudado);
    event FondosLiberados(uint256 indexed etapa, address indexed proveedor, uint256 monto);
    event ReembolsoActivado(CampanaEmergencia.MotivoReembolso motivo, uint256 etapa);

    function setUp() public override {
        super.setUp();
        c = _crearCampana();
    }

    // ═══════════════════════ Camino feliz ═══════════════════════

    function test_CaminoFeliz_50Donantes_TresEtapas() public {
        (address[] memory ds, uint256[] memory ms) = _donar50(c);

        // La donación 50 completa la meta exacta y cierra el recaudo automáticamente.
        assertEq(c.totalRecaudado(), META);
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.EnEjecucion));
        assertEq(c.numeroDonantes(), 50);
        assertEq(cop.balanceOf(address(c)), META);

        // Montos planeados por etapa: 30 % / 40 % / 30 %
        CampanaEmergencia.Etapa[] memory es = c.etapas();
        assertEq(es[0].monto, 3_000_000 ether);
        assertEq(es[1].monto, 4_000_000 ether);
        assertEq(es[2].monto, 3_000_000 ether);

        // Etapa 1: mercados → supermercado
        _proponer(c, 0, supermercado);
        vm.prank(verificador1);
        c.confirmarEntrega(0, ACTA, "", 0);
        assertEq(cop.balanceOf(supermercado), 0, "con 1 de 3 no se paga");

        vm.expectEmit(true, true, false, true, address(c));
        emit FondosLiberados(0, supermercado, 3_000_000 ether);
        vm.prank(verificador3);
        c.confirmarEntrega(0, ACTA, "", 0);
        assertEq(cop.balanceOf(supermercado), 3_000_000 ether);
        assertEq(uint256(c.etapa(0).estado), uint256(CampanaEmergencia.EstadoEtapa.Pagada));
        assertEq(c.etapaActual(), 1);

        // Etapa 2 y 3
        _proponer(c, 1, ferreteria);
        _aprobar(c, 1);
        _proponer(c, 2, constructora);
        _aprobar(c, 2);

        assertEq(cop.balanceOf(ferreteria), 4_000_000 ether);
        assertEq(cop.balanceOf(constructora), 3_000_000 ether);
        assertEq(cop.balanceOf(address(c)), 0, "todo el dinero salio a proveedores");
        assertEq(c.totalPagado(), META);
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.Finalizada));

        // La fundación nunca tocó el dinero.
        assertEq(cop.balanceOf(fundacion), 0);

        // Cada donante: todo su aporte fue a proveedores.
        for (uint256 i = 0; i < 50; i++) {
            CampanaEmergencia.ResumenDonante memory r = c.resumenDonante(ds[i]);
            assertEq(r.aporte, ms[i]);
            assertApproxEqAbs(r.pagadoAProveedores, ms[i], 3, "redondeo de a lo sumo 1 wei por etapa");
            assertEq(r.reembolsable, 0);
        }
    }

    /// @dev El ejemplo del documento: "De tus 200.000: 60.000 en mercados, 80.000 en materiales,
    ///      60.000 pendientes".
    function test_EjemploDelDocumento_DondeFueCadaPeso() public {
        address yo = makeAddr("yo");
        _donar(c, yo, 200_000 ether); // 2 % de la meta
        _donar(c, makeAddr("resto"), META - 200_000 ether);

        _proponer(c, 0, supermercado);
        _aprobar(c, 0);
        _proponer(c, 1, ferreteria);
        _aprobar(c, 1);

        CampanaEmergencia.ResumenDonante memory r = c.resumenDonante(yo);
        assertEq(r.partePorEtapa[0], 60_000 ether, "mercados");
        assertEq(r.partePorEtapa[1], 80_000 ether, "materiales");
        assertEq(r.partePorEtapa[2], 60_000 ether, "reconstruccion");
        assertEq(r.pagadoAProveedores, 140_000 ether);
        assertEq(r.pendiente, 60_000 ether);
        assertEq(r.reembolsable, 0);
    }

    function test_DonacionEmiteEvento() public {
        address d = makeAddr("d");
        _fondear(d, 5000 ether);
        vm.startPrank(d);
        cop.approve(address(c), 5000 ether);
        vm.expectEmit(true, false, false, true, address(c));
        emit Donacion(d, 5000 ether, 5000 ether, 5000 ether);
        c.donar(5000 ether);
        vm.stopPrank();

        CampanaEmergencia.RegistroDonacion[] memory h = c.donaciones(0, 10);
        assertEq(h.length, 1);
        assertEq(h[0].donante, d);
        assertEq(h[0].monto, 5000 ether);
        assertEq(h[0].bloque, block.number);
    }

    function test_VariasDonacionesDelMismoDonante() public {
        address d = makeAddr("d");
        _donar(c, d, 5000 ether);
        _donar(c, d, 10_000 ether);
        assertEq(c.aportes(d), 15_000 ether);
        assertEq(c.numeroDonantes(), 1);
        assertEq(c.numeroDonaciones(), 2);
        assertEq(recibo.balanceOf(d), 1, "un solo recibo por campana");
    }

    // ═══════════════════════ Permit (una sola transacción) ═══════════════════════

    function _firmarPermit(uint256 pk, address spender, uint256 valor, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        address owner = vm.addr(pk);
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                owner,
                spender,
                valor,
                cop.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", cop.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }

    function test_DonarConPermit_UnaSolaTransaccion() public {
        uint256 pk = 0xD0;
        address d = vm.addr(pk);
        _fondear(d, 10_000 ether);
        (uint8 v, bytes32 r, bytes32 s) =
            _firmarPermit(pk, address(c), 10_000 ether, block.timestamp + 1 hours);

        vm.prank(d);
        c.donarConPermit(10_000 ether, block.timestamp + 1 hours, v, r, s);
        assertEq(c.aportes(d), 10_000 ether);
        assertEq(cop.balanceOf(d), 0);
    }

    function test_DonarConPermit_SiAlguienAdelantaElPermit() public {
        uint256 pk = 0xD1;
        address d = vm.addr(pk);
        _fondear(d, 10_000 ether);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _firmarPermit(pk, address(c), 10_000 ether, deadline);

        // Un tercero envía el permit antes (front-running): la donación igual debe funcionar.
        cop.permit(d, address(c), 10_000 ether, deadline, v, r, s);
        vm.prank(d);
        c.donarConPermit(10_000 ether, deadline, v, r, s);
        assertEq(c.aportes(d), 10_000 ether);
    }

    function test_RevertSi_PermitInvalido() public {
        uint256 pk = 0xD2;
        address d = vm.addr(pk);
        _fondear(d, 10_000 ether);
        (uint8 v, bytes32 r, bytes32 s) =
            _firmarPermit(0xBAD, address(c), 10_000 ether, block.timestamp + 1 hours);
        vm.prank(d);
        vm.expectRevert(CampanaEmergencia.PermisoInvalido.selector);
        c.donarConPermit(10_000 ether, block.timestamp + 1 hours, v, r, s);
    }

    // ═══════════════════════ Recaudo y meta ═══════════════════════

    function test_DonacionMayorALaMeta_SoloCobraLoQueFalta() public {
        address a = makeAddr("a");
        address b = makeAddr("b");
        _donar(c, a, META - 1000 ether);

        _fondear(b, 50_000 ether);
        vm.startPrank(b);
        cop.approve(address(c), 50_000 ether);
        c.donar(50_000 ether);
        vm.stopPrank();

        assertEq(c.aportes(b), 1000 ether);
        assertEq(cop.balanceOf(b), 49_000 ether, "el resto se queda en su wallet");
        assertEq(c.totalRecaudado(), META);
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.EnEjecucion));
    }

    function test_RevertSi_DonaDespuesDeCerrar() public {
        _donar(c, makeAddr("a"), 1000 ether);
        vm.prank(fundacion);
        c.cerrarRecaudo();

        address b = makeAddr("b");
        _fondear(b, 1000 ether);
        vm.startPrank(b);
        cop.approve(address(c), 1000 ether);
        vm.expectRevert(CampanaEmergencia.EstadoInvalido.selector);
        c.donar(1000 ether);
        vm.stopPrank();
    }

    function test_RevertSi_DonaDespuesDelPlazo() public {
        address b = makeAddr("b");
        _fondear(b, 1000 ether);
        vm.warp(block.timestamp + DURACION_RECAUDO + 1);
        vm.startPrank(b);
        cop.approve(address(c), 1000 ether);
        vm.expectRevert(CampanaEmergencia.RecaudoVencido.selector);
        c.donar(1000 ether);
        vm.stopPrank();
    }

    function test_RevertSi_DonaCero() public {
        vm.prank(makeAddr("a"));
        vm.expectRevert(CampanaEmergencia.MontoCero.selector);
        c.donar(0);
    }

    function test_CierreParcial_MontosProporcionalesALoRecaudado() public {
        _donar(c, makeAddr("a"), 1_000_001 ether);
        vm.prank(fundacion);
        c.cerrarRecaudo();
        CampanaEmergencia.Etapa[] memory es = c.etapas();
        assertEq(es[0].monto, 300_000.3 ether);
        assertEq(es[1].monto, 400_000.4 ether);
        assertEq(es[0].monto + es[1].monto + es[2].monto, 1_000_001 ether, "sin polvo");
    }

    function test_CerrarRecaudo_Permisos() public {
        _donar(c, makeAddr("a"), 1000 ether);

        vm.prank(intruso);
        vm.expectRevert(CampanaEmergencia.NoAutorizado.selector);
        c.cerrarRecaudo();

        // Vencido el plazo, cualquiera puede cerrarlo.
        vm.warp(block.timestamp + DURACION_RECAUDO + 1);
        vm.prank(intruso);
        c.cerrarRecaudo();
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.EnEjecucion));
    }

    function test_RevertSi_CierraSinFondos() public {
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.SinFondos.selector);
        c.cerrarRecaudo();
    }

    // ═══════════════════════ Caso de falla: etapa rechazada ═══════════════════════

    function test_EtapaRechazada_DonantesRecuperanLoNoPagado() public {
        (address[] memory ds, uint256[] memory ms) = _donar50(c);
        _proponer(c, 0, supermercado);
        _aprobar(c, 0); // 3.000.000 pagados

        _proponer(c, 1, ferreteria);
        vm.prank(verificador2);
        c.confirmarEntrega(1, ACTA, "", 0); // 1 confirma...

        // ...pero 2 rechazan → rechazada
        vm.prank(verificador1);
        c.rechazarEtapa(1, MOTIVO, "");
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.EnEjecucion));
        vm.expectEmit(false, false, false, true, address(c));
        emit ReembolsoActivado(CampanaEmergencia.MotivoReembolso.EtapaRechazada, 1);
        vm.prank(verificador3);
        c.rechazarEtapa(1, MOTIVO, "");

        assertEq(uint256(c.etapa(1).estado), uint256(CampanaEmergencia.EstadoEtapa.Rechazada));
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.Reembolso));
        assertEq(cop.balanceOf(ferreteria), 0, "la ferreteria no cobra");

        uint256 sumaReembolsos;
        for (uint256 i = 0; i < 50; i++) {
            uint256 esperado = (ms[i] * 7_000_000 ether) / META; // 70 % sin pagar
            assertEq(c.reembolsoDisponible(ds[i]), esperado);
            uint256 antes = cop.balanceOf(ds[i]);
            vm.prank(ds[i]);
            c.reclamarReembolso();
            assertEq(cop.balanceOf(ds[i]) - antes, esperado);
            sumaReembolsos += esperado;

            CampanaEmergencia.ResumenDonante memory r = c.resumenDonante(ds[i]);
            assertEq(r.reembolsado, esperado);
            assertEq(r.reembolsable, 0);
            assertEq(r.pendiente, 0);
        }
        assertEq(c.totalReembolsado(), sumaReembolsos);
        assertLe(cop.balanceOf(address(c)), 50, "solo queda polvo de redondeo");
        assertEq(c.totalPagado() + c.totalReembolsado() + cop.balanceOf(address(c)), META);
    }

    function test_RevertSi_ReclamaDosVeces() public {
        address d = makeAddr("d");
        _donar(c, d, 1000 ether);
        vm.prank(fundacion);
        c.cancelar();
        vm.startPrank(d);
        c.reclamarReembolso();
        vm.expectRevert(CampanaEmergencia.NadaQueReclamar.selector);
        c.reclamarReembolso();
        vm.stopPrank();
    }

    function test_RevertSi_ReclamaSinReembolsoActivo() public {
        address d = makeAddr("d");
        _donar(c, d, 1000 ether);
        vm.prank(d);
        vm.expectRevert(CampanaEmergencia.NadaQueReclamar.selector);
        c.reclamarReembolso();
    }

    function test_RevertSi_NoDonanteReclama() public {
        _donar(c, makeAddr("d"), 1000 ether);
        vm.prank(fundacion);
        c.cancelar();
        vm.prank(intruso);
        vm.expectRevert(CampanaEmergencia.NadaQueReclamar.selector);
        c.reclamarReembolso();
    }

    // ═══════════════════════ Caso de falla: plazo vencido ═══════════════════════

    function test_PlazoVencido_ActivaReembolso() public {
        address d = makeAddr("d");
        _donar(c, d, META);
        _proponer(c, 0, supermercado);
        vm.prank(verificador1);
        c.confirmarEntrega(0, ACTA, "", 0);

        vm.expectRevert(CampanaEmergencia.PlazoNoVencido.selector);
        c.activarReembolsoPorVencimiento();

        vm.warp(block.timestamp + 3 days + 1);

        // Ya no se puede confirmar fuera de plazo.
        vm.prank(verificador2);
        vm.expectRevert(CampanaEmergencia.PlazoVencido.selector);
        c.confirmarEntrega(0, ACTA, "", 0);

        vm.prank(intruso); // cualquiera puede activarlo
        c.activarReembolsoPorVencimiento();
        assertEq(uint256(c.motivoReembolso()), uint256(CampanaEmergencia.MotivoReembolso.PlazoVencido));

        vm.prank(d);
        c.reclamarReembolso();
        assertEq(cop.balanceOf(d), META);
    }

    function test_PlazoDeLaSegundaEtapaCorreDesdeElPagoDeLaPrimera() public {
        _donar(c, makeAddr("d"), META);
        vm.warp(block.timestamp + 2 days);
        _proponer(c, 0, supermercado);
        _aprobar(c, 0);
        uint256 pagadaEn = block.timestamp;
        assertEq(c.etapa(1).fechaLimite, pagadaEn + 10 days);

        vm.warp(pagadaEn + 10 days);
        _proponer(c, 1, ferreteria); // justo en el límite todavía se puede
        vm.warp(pagadaEn + 10 days + 1);
        c.activarReembolsoPorVencimiento();
        assertEq(uint256(c.estado()), uint256(CampanaEmergencia.EstadoCampana.Reembolso));
    }

    function test_RevertSi_ProponeFueraDePlazo() public {
        _donar(c, makeAddr("d"), META);
        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.PlazoVencido.selector);
        c.proponerDesembolso(0, supermercado, FACTURA, "", 0);
    }

    // ═══════════════════════ Cancelación ═══════════════════════

    function test_CancelarDuranteRecaudo_DevuelveTodo() public {
        address a = makeAddr("a");
        address b = makeAddr("b");
        _donar(c, a, 30_000 ether);
        _donar(c, b, 70_000 ether);
        vm.prank(fundacion);
        c.cancelar();
        vm.prank(a);
        c.reclamarReembolso();
        vm.prank(b);
        c.reclamarReembolso();
        assertEq(cop.balanceOf(a), 30_000 ether);
        assertEq(cop.balanceOf(b), 70_000 ether);
        assertEq(cop.balanceOf(address(c)), 0);
    }

    function test_RevertSi_CancelaQuienNoEsFundacion() public {
        vm.prank(intruso);
        vm.expectRevert(CampanaEmergencia.SoloFundacion.selector);
        c.cancelar();
    }

    function test_RevertSi_CancelaCampanaFinalizada() public {
        _donar(c, makeAddr("d"), META);
        for (uint256 i = 0; i < 3; i++) {
            _proponer(c, i, supermercado);
            _aprobar(c, i);
        }
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.EstadoInvalido.selector);
        c.cancelar();
    }

    // ═══════════════════════ Accesos no autorizados ═══════════════════════

    function test_RevertSi_ProponeQuienNoEsFundacion() public {
        _donar(c, makeAddr("d"), META);
        vm.prank(intruso);
        vm.expectRevert(CampanaEmergencia.SoloFundacion.selector);
        c.proponerDesembolso(0, supermercado, FACTURA, "", 0);

        // Ni siquiera un verificador o el proveedor pueden proponer.
        vm.prank(supermercado);
        vm.expectRevert(CampanaEmergencia.SoloFundacion.selector);
        c.proponerDesembolso(0, supermercado, FACTURA, "", 0);
    }

    function test_RevertSi_ConfirmaQuienNoEsVerificador() public {
        _donar(c, makeAddr("d"), META);
        _proponer(c, 0, supermercado);

        vm.prank(intruso);
        vm.expectRevert(CampanaEmergencia.SoloVerificador.selector);
        c.confirmarEntrega(0, ACTA, "", 0);

        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.SoloVerificador.selector);
        c.confirmarEntrega(0, ACTA, "", 0);

        vm.prank(supermercado);
        vm.expectRevert(CampanaEmergencia.SoloVerificador.selector);
        c.confirmarEntrega(0, ACTA, "", 0);
    }

    function test_RevertSi_VerificadorDeOtraCampana() public {
        _donar(c, makeAddr("d"), META);
        _proponer(c, 0, supermercado);
        // Registrado como verificador en el sistema, pero no asignado a ESTA campaña.
        vm.prank(verificadorExterno);
        vm.expectRevert(CampanaEmergencia.SoloVerificador.selector);
        c.confirmarEntrega(0, ACTA, "", 0);
    }

    function test_RevertSi_VerificadorRevocado() public {
        _donar(c, makeAddr("d"), META);
        _proponer(c, 0, supermercado);
        registro.revocarActor(registro.VERIFICADOR_ROLE(), verificador1);
        vm.prank(verificador1);
        vm.expectRevert(CampanaEmergencia.SoloVerificador.selector);
        c.confirmarEntrega(0, ACTA, "", 0);
    }

    function test_RevertSi_VerificadorVotaDosVeces() public {
        _donar(c, makeAddr("d"), META);
        _proponer(c, 0, supermercado);
        vm.startPrank(verificador1);
        c.confirmarEntrega(0, ACTA, "", 0);
        vm.expectRevert(CampanaEmergencia.YaVoto.selector);
        c.confirmarEntrega(0, ACTA, "", 0);
        vm.expectRevert(CampanaEmergencia.YaVoto.selector);
        c.rechazarEtapa(0, MOTIVO, "");
        vm.stopPrank();
    }

    function test_RevertSi_ProveedorNoRegistrado() public {
        _donar(c, makeAddr("d"), META);
        vm.prank(fundacion);
        vm.expectRevert(
            abi.encodeWithSelector(CampanaEmergencia.ProveedorNoAutorizado.selector, intruso)
        );
        c.proponerDesembolso(0, intruso, FACTURA, "", 0);
    }

    function test_RevertSi_FundacionSePagaASiMisma() public {
        // Aunque la fundación se registre también como proveedor, no puede cobrar.
        registro.registrarActor(registro.PROVEEDOR_ROLE(), fundacion, "Fundacion como proveedor");
        _donar(c, makeAddr("d"), META);
        vm.prank(fundacion);
        vm.expectRevert(
            abi.encodeWithSelector(CampanaEmergencia.ConflictoDeInteres.selector, fundacion)
        );
        c.proponerDesembolso(0, fundacion, FACTURA, "", 0);
    }

    function test_RevertSi_VerificadorEsProveedor() public {
        registro.registrarActor(registro.PROVEEDOR_ROLE(), verificador1, "Verificador proveedor");
        _donar(c, makeAddr("d"), META);
        vm.prank(fundacion);
        vm.expectRevert(
            abi.encodeWithSelector(CampanaEmergencia.ConflictoDeInteres.selector, verificador1)
        );
        c.proponerDesembolso(0, verificador1, FACTURA, "", 0);
    }

    function test_RevertSi_ProveedorRevocadoAntesDelPago() public {
        _donar(c, makeAddr("d"), META);
        _proponer(c, 0, supermercado);
        vm.prank(verificador1);
        c.confirmarEntrega(0, ACTA, "", 0);
        registro.revocarActor(registro.PROVEEDOR_ROLE(), supermercado);

        vm.prank(verificador2);
        vm.expectRevert(
            abi.encodeWithSelector(CampanaEmergencia.ProveedorNoAutorizado.selector, supermercado)
        );
        c.confirmarEntrega(0, ACTA, "", 0);
        assertEq(cop.balanceOf(supermercado), 0);
    }

    function test_RevertSi_SaltaEtapas() public {
        _donar(c, makeAddr("d"), META);
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.EtapaInvalida.selector);
        c.proponerDesembolso(1, ferreteria, FACTURA, "", 0);
    }

    function test_RevertSi_ProponeDosVeces() public {
        _donar(c, makeAddr("d"), META);
        _proponer(c, 0, supermercado);
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.EstadoEtapaInvalido.selector);
        c.proponerDesembolso(0, ferreteria, FACTURA, "", 0);
    }

    function test_RevertSi_ConfirmaSinPropuesta() public {
        _donar(c, makeAddr("d"), META);
        vm.prank(verificador1);
        vm.expectRevert(CampanaEmergencia.EstadoEtapaInvalido.selector);
        c.confirmarEntrega(0, ACTA, "", 0);
    }

    function test_RevertSi_ProponeDuranteRecaudo() public {
        _donar(c, makeAddr("d"), 1000 ether);
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.EstadoInvalido.selector);
        c.proponerDesembolso(0, supermercado, FACTURA, "", 0);
    }

    function test_RevertSi_HashesVacios() public {
        _donar(c, makeAddr("d"), META);
        vm.prank(fundacion);
        vm.expectRevert(CampanaEmergencia.HashVacio.selector);
        c.proponerDesembolso(0, supermercado, bytes32(0), "", 0);

        _proponer(c, 0, supermercado);
        vm.prank(verificador1);
        vm.expectRevert(CampanaEmergencia.HashVacio.selector);
        c.confirmarEntrega(0, bytes32(0), "", 0);
    }

    // ═══════════════════════ Lecturas ═══════════════════════

    function test_VotosYEvidencias() public {
        _donar(c, makeAddr("d"), META);
        _proponer(c, 0, supermercado);
        vm.prank(verificador1);
        c.confirmarEntrega(0, ACTA, "ipfs://acta", 0);
        vm.prank(verificador3);
        c.rechazarEtapa(0, MOTIVO, "ipfs://motivo");

        (CampanaEmergencia.Voto[] memory vs, bytes32[] memory ev, string[] memory uris,) = c.votos(0);
        assertEq(uris[0], "ipfs://acta");
        assertEq(uris[1], "");
        assertEq(uris[2], "ipfs://motivo");
        assertEq(uint256(vs[0]), uint256(CampanaEmergencia.Voto.Confirma));
        assertEq(uint256(vs[1]), uint256(CampanaEmergencia.Voto.Ninguno));
        assertEq(uint256(vs[2]), uint256(CampanaEmergencia.Voto.Rechaza));
        assertEq(ev[0], ACTA);
        assertEq(ev[2], MOTIVO);
    }

    function test_Info() public {
        _donar(c, makeAddr("d"), 1000 ether);
        CampanaEmergencia.InfoCampana memory i = c.info();
        assertEq(i.direccion, address(c));
        assertEq(i.fundacion, fundacion);
        assertEq(i.meta, META);
        assertEq(i.totalRecaudado, 1000 ether);
        assertEq(i.numeroEtapas, 3);
        assertEq(i.verificadores.length, 3);
        assertEq(i.umbral, 2);
        assertEq(i.rechazosParaRechazar, 2);
    }

    function test_Paginacion() public {
        for (uint256 i = 0; i < 5; i++) {
            _donar(c, _donante(i), 1000 ether * (i + 1));
        }
        (address[] memory cs, uint256[] memory ms) = c.donantes(1, 2);
        assertEq(cs.length, 2);
        assertEq(cs[0], _donante(1));
        assertEq(ms[1], 3000 ether);

        assertEq(c.donaciones(3, 100).length, 2);
        assertEq(c.donaciones(5, 10).length, 0);
        assertEq(c.donaciones(99, 10).length, 0, "desde fuera de rango no revierte");
        assertEq(c.donaciones(0, type(uint256).max).length, 5, "cantidad enorme no desborda");
    }
}
