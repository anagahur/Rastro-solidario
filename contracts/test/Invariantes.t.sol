// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BaseTest } from "./utils/BaseTest.sol";
import { MockCOP } from "../src/MockCOP.sol";
import { CampanaEmergencia } from "../src/CampanaEmergencia.sol";

/// @dev Actor aleatorio: dona, compromete matching, cierra, propone, vota, deja vencer plazos y reclama.
contract Handler is Test {
    CampanaEmergencia public c;
    MockCOP public cop;
    address public fundacion;
    address[3] public verificadores;
    address[3] public proveedores;
    address public empresa;
    address[] public donantes;

    uint256 public sumaEntrante;
    uint256 public sumaPagadaObservada;

    constructor(
        CampanaEmergencia c_,
        MockCOP cop_,
        address fundacion_,
        address[3] memory verificadores_,
        address[3] memory proveedores_,
        address empresa_
    ) {
        c = c_;
        cop = cop_;
        fundacion = fundacion_;
        verificadores = verificadores_;
        proveedores = proveedores_;
        empresa = empresa_;
        for (uint256 i = 0; i < 8; i++) {
            donantes.push(address(uint160(0xD000 + i)));
        }
        donantes.push(empresa_); // la empresa también reclama su parte si hay reembolso
    }

    function donar(uint256 quien, uint256 monto) external {
        address d = donantes[quien % donantes.length];
        monto = bound(monto, 1 ether, 3_000_000 ether);
        address[] memory a = new address[](1);
        uint256[] memory m = new uint256[](1);
        a[0] = d;
        m[0] = monto;
        cop.mintLote(a, m);
        uint256 antes = c.totalRecaudado();
        vm.startPrank(d);
        cop.approve(address(c), monto);
        try c.donar(monto) {
            sumaEntrante += c.totalRecaudado() - antes;
        } catch { }
        vm.stopPrank();
    }

    function comprometer(uint256 proporcion, uint256 tope) external {
        uint16 bps = uint16(bound(proporcion, 1, 30_000));
        tope = bound(tope, 1 ether, 4_000_000 ether);
        address[] memory a = new address[](1);
        uint256[] memory m = new uint256[](1);
        a[0] = empresa;
        m[0] = tope;
        cop.mintLote(a, m);
        vm.startPrank(empresa);
        cop.approve(address(c), tope);
        try c.comprometerMatching(bps, tope) { } catch { }
        vm.stopPrank();
    }

    function cerrar() external {
        vm.prank(fundacion);
        try c.cerrarRecaudo() { } catch { }
    }

    function proponer(uint256 prov) external {
        uint256 id = c.etapaActual();
        vm.prank(fundacion);
        try c.proponerDesembolso(id, proveedores[prov % 3], keccak256("factura"), "", 0) { } catch { }
    }

    function votar(uint256 quien, bool confirma) external {
        uint256 id = c.etapaActual();
        address v = verificadores[quien % 3];
        uint256 pagadoAntes = c.totalPagado();
        vm.prank(v);
        if (confirma) {
            try c.confirmarEntrega(id, keccak256("acta"), "", 0) { } catch { }
        } else {
            try c.rechazarEtapa(id, keccak256("motivo"), "") { } catch { }
        }
        sumaPagadaObservada += c.totalPagado() - pagadoAntes;
    }

    function pasarTiempo(uint256 segundos) external {
        vm.warp(block.timestamp + bound(segundos, 1 hours, 15 days));
    }

    function vencer() external {
        try c.activarReembolsoPorVencimiento() { } catch { }
    }

    function cancelar() external {
        vm.prank(fundacion);
        try c.cancelar() { } catch { }
    }

    function reclamar(uint256 quien) external {
        vm.prank(donantes[quien % donantes.length]);
        try c.reclamarReembolso() { } catch { }
    }
}

contract InvariantesTest is BaseTest {
    CampanaEmergencia internal c;
    Handler internal handler;

    function setUp() public override {
        super.setUp();
        c = _crearCampana();
        handler = new Handler(
            c,
            cop,
            fundacion,
            [verificador1, verificador2, verificador3],
            [supermercado, ferreteria, constructora],
            empresa
        );
        cop.transferOwnership(address(handler)); // el handler necesita mintLote
        targetContract(address(handler));
    }

    /// @notice El saldo del contrato siempre es lo recaudado menos lo que salió, más el matching
    ///         que las empresas tienen bloqueado y todavía no se ha usado.
    function invariant_SaldoCuadra() public view {
        assertEq(
            cop.balanceOf(address(c)),
            c.totalRecaudado() - c.totalPagado() - c.totalReembolsado() + c.matchingBloqueado()
        );
    }

    /// @notice Lo usado del matching nunca supera lo comprometido, y al cerrar no queda bloqueado.
    function invariant_MatchingCuadra() public view {
        CampanaEmergencia.Matching[] memory ms = c.matchings();
        uint256 usado;
        uint256 libre;
        for (uint256 i = 0; i < ms.length; i++) {
            assertLe(ms[i].usado, ms[i].tope);
            usado += ms[i].usado;
            libre += ms[i].tope - ms[i].usado;
        }
        assertEq(usado, c.matchingUsado());
        assertEq(libre, c.matchingBloqueado());
        if (c.estado() != CampanaEmergencia.EstadoCampana.Recaudando) assertEq(libre, 0);
    }

    /// @notice Nunca sale más dinero del que entró, y nunca se recauda más que la meta.
    function invariant_NuncaSaleMasDeLoQueEntro() public view {
        assertLe(c.totalPagado() + c.totalReembolsado(), c.totalRecaudado());
        assertLe(c.totalRecaudado(), META);
        assertEq(c.totalRecaudado(), handler.sumaEntrante());
    }

    /// @notice La fundación nunca recibe dinero.
    function invariant_FundacionNuncaCobra() public view {
        assertEq(cop.balanceOf(fundacion), 0);
    }

    /// @notice Lo pagado son exactamente las etapas en estado Pagada, y van a proveedores.
    function invariant_PagosSoloAEtapasPagadas() public view {
        CampanaEmergencia.Etapa[] memory es = c.etapas();
        uint256 suma;
        for (uint256 i = 0; i < es.length; i++) {
            if (es[i].estado == CampanaEmergencia.EstadoEtapa.Pagada) suma += es[i].monto;
        }
        assertEq(suma, c.totalPagado());
        assertEq(
            cop.balanceOf(supermercado) + cop.balanceOf(ferreteria) + cop.balanceOf(constructora),
            c.totalPagado()
        );
        assertEq(handler.sumaPagadaObservada(), c.totalPagado());
    }
}
