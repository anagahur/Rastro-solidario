// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { BaseTest } from "./utils/BaseTest.sol";
import { CampanaEmergencia } from "../src/CampanaEmergencia.sol";

/// @notice Fuzz: con donaciones y caminos aleatorios, el dinero siempre cuadra.
contract FuzzTest is BaseTest {
    function testFuzz_ConservacionDelDinero(
        uint256 semilla,
        uint8 nDonantes,
        uint8 etapasPagadas,
        bool porRechazo
    ) public {
        CampanaEmergencia c = _crearCampana();
        nDonantes = uint8(bound(nDonantes, 1, 40));
        etapasPagadas = uint8(bound(etapasPagadas, 0, 2)); // 0..2 pagadas, luego falla

        address[] memory ds = new address[](nDonantes);
        uint256[] memory ms = new uint256[](nDonantes);
        for (uint256 i = 0; i < nDonantes; i++) {
            ds[i] = _donante(i);
            // entre 5.000 y 300.000 pesos, con decimales "raros" para forzar redondeos
            ms[i] = bound(uint256(keccak256(abi.encode(semilla, i))), 5000 ether, 300_000 ether) + i;
            _donar(c, ds[i], ms[i]);
        }
        uint256 total = c.totalRecaudado();
        if (c.estado() == CampanaEmergencia.EstadoCampana.Recaudando) {
            vm.prank(fundacion);
            c.cerrarRecaudo();
        }

        address[3] memory provs = [supermercado, ferreteria, constructora];
        for (uint256 i = 0; i < etapasPagadas; i++) {
            _proponer(c, i, provs[i]);
            _aprobar(c, i);
        }

        if (porRechazo) {
            _proponer(c, etapasPagadas, provs[etapasPagadas]);
            _rechazar(c, etapasPagadas);
        } else {
            vm.warp(block.timestamp + 31 days);
            c.activarReembolsoPorVencimiento();
        }

        uint256 pagado = c.totalPagado();
        for (uint256 i = 0; i < nDonantes; i++) {
            uint256 esperado = (ms[i] * (total - pagado)) / total;
            if (esperado == 0) continue;
            vm.prank(ds[i]);
            c.reclamarReembolso();
        }

        uint256 saldo = cop.balanceOf(address(c));
        assertEq(pagado + c.totalReembolsado() + saldo, total, "conservacion");
        assertLe(saldo, nDonantes, "a lo sumo 1 wei de polvo por donante");
        assertLe(pagado + c.totalReembolsado(), total, "nunca sale mas de lo que entro");
    }

    function testFuzz_ParteDonanteProporcional(uint256 aporte, uint256 resto) public {
        aporte = bound(aporte, 1 ether, META - 1 ether);
        resto = META - aporte;
        CampanaEmergencia c = _crearCampana();
        address yo = makeAddr("yo");
        _donar(c, yo, aporte);
        _donar(c, makeAddr("otro"), resto);

        CampanaEmergencia.ResumenDonante memory r = c.resumenDonante(yo);
        uint256 suma = r.partePorEtapa[0] + r.partePorEtapa[1] + r.partePorEtapa[2];
        assertApproxEqAbs(suma, aporte, 3);
        assertEq(r.partePorEtapa[0], (aporte * 3000) / 10_000);
    }
}
