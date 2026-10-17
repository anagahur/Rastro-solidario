// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { MockCOP } from "../../src/MockCOP.sol";
import { RegistroActores } from "../../src/RegistroActores.sol";
import { ReciboDonacion, ICampanaFactory } from "../../src/ReciboDonacion.sol";
import { CampanaFactory } from "../../src/CampanaFactory.sol";
import { CampanaEmergencia, IReciboDonacion } from "../../src/CampanaEmergencia.sol";
import {
    HistorialReputacion,
    IHistorialReputacion,
    ICampanaFactoryReputacion
} from "../../src/HistorialReputacion.sol";
import { ReenviadorGas } from "../../src/ReenviadorGas.sol";

/// @dev Monta el sistema completo con los actores del documento:
///      fundación, 3 verificadores (2 de 3) y 3 proveedores.
abstract contract BaseTest is Test {
    uint256 internal constant META = 10_000_000 ether;
    uint64 internal constant DURACION_RECAUDO = 7 days;

    MockCOP internal cop;
    RegistroActores internal registro;
    ReciboDonacion internal recibo;
    CampanaFactory internal factory;
    HistorialReputacion internal reputacion;
    ReenviadorGas internal reenviador;

    address internal admin = address(this);
    address internal fundacion = makeAddr("fundacion");
    address internal verificador1 = makeAddr("defensaCivil");
    address internal verificador2 = makeAddr("juntaAccionComunal");
    address internal verificador3 = makeAddr("personeria");
    address internal verificadorExterno = makeAddr("verificadorExterno");
    address internal supermercado = makeAddr("supermercado");
    address internal ferreteria = makeAddr("ferreteria");
    address internal constructora = makeAddr("constructora");
    address internal intruso = makeAddr("intruso");
    address internal empresa = makeAddr("empresaAliada");
    address internal empresa2 = makeAddr("empresaAliada2");

    bytes32 internal constant FACTURA = keccak256("factura-mercados.pdf");
    bytes32 internal constant ACTA = keccak256("foto-acta-entrega.jpg");
    bytes32 internal constant MOTIVO = keccak256("la entrega no ocurrio");

    function setUp() public virtual {
        cop = new MockCOP();
        registro = new RegistroActores(admin);
        recibo = new ReciboDonacion(admin);
        reputacion = new HistorialReputacion(admin);
        reenviador = new ReenviadorGas();
        factory = new CampanaFactory(
            cop,
            registro,
            IReciboDonacion(address(recibo)),
            IHistorialReputacion(address(reputacion)),
            address(reenviador)
        );
        recibo.configurarFactory(ICampanaFactory(address(factory)));
        reputacion.configurarFactory(ICampanaFactoryReputacion(address(factory)));
        recibo.configurarUrlBase("https://rastro.test/");

        registro.registrarActor(registro.FUNDACION_ROLE(), fundacion, "Fundacion Antioquia Ayuda");
        registro.registrarActor(registro.VERIFICADOR_ROLE(), verificador1, "Defensa Civil");
        registro.registrarActor(registro.VERIFICADOR_ROLE(), verificador2, "Junta de Accion Comunal");
        registro.registrarActor(registro.VERIFICADOR_ROLE(), verificador3, "Personeria Municipal");
        registro.registrarActor(registro.VERIFICADOR_ROLE(), verificadorExterno, "Otro verificador");
        registro.registrarActor(registro.PROVEEDOR_ROLE(), supermercado, "Supermercado La Economia");
        registro.registrarActor(registro.PROVEEDOR_ROLE(), ferreteria, "Ferreteria El Constructor");
        registro.registrarActor(registro.PROVEEDOR_ROLE(), constructora, "Constructora Comunitaria");
        registro.registrarActor(registro.EMPRESA_ROLE(), empresa, "Empresa Aliada S.A.S.");
        registro.registrarActor(registro.EMPRESA_ROLE(), empresa2, "Otra Empresa S.A.S.");
    }

    /// @dev Dependencias para crear una campaña fuera de la factory (casos de prueba).
    function _dep(IReciboDonacion r) internal view returns (CampanaEmergencia.Dependencias memory) {
        return CampanaEmergencia.Dependencias({
            token: cop,
            registro: registro,
            recibo: r,
            reputacion: IHistorialReputacion(address(reputacion)),
            reenviador: address(reenviador)
        });
    }

    // ───────────── Helpers de configuración ─────────────

    function _config() internal view returns (CampanaEmergencia.ConfigCampana memory cfg) {
        cfg.nombre = "Inundacion en Antioquia";
        cfg.descripcion = "Ayuda para familias afectadas por la inundacion";
        cfg.meta = META;
        cfg.duracionRecaudo = DURACION_RECAUDO;

        cfg.verificadores = new address[](3);
        cfg.verificadores[0] = verificador1;
        cfg.verificadores[1] = verificador2;
        cfg.verificadores[2] = verificador3;
        cfg.umbral = 2;

        cfg.descripcionesEtapas = new string[](3);
        cfg.descripcionesEtapas[0] = "Mercados";
        cfg.descripcionesEtapas[1] = "Materiales";
        cfg.descripcionesEtapas[2] = "Reconstruccion";

        cfg.porcentajesBps = new uint16[](3);
        cfg.porcentajesBps[0] = 3000;
        cfg.porcentajesBps[1] = 4000;
        cfg.porcentajesBps[2] = 3000;

        cfg.plazosEtapas = new uint64[](3);
        cfg.plazosEtapas[0] = 3 days;
        cfg.plazosEtapas[1] = 10 days;
        cfg.plazosEtapas[2] = 30 days;
    }

    function _crearCampana() internal returns (CampanaEmergencia) {
        return _crearCampana(_config());
    }

    function _crearCampana(CampanaEmergencia.ConfigCampana memory cfg)
        internal
        returns (CampanaEmergencia)
    {
        vm.prank(fundacion);
        return CampanaEmergencia(factory.crearCampana(cfg));
    }

    // ───────────── Helpers de flujo ─────────────

    function _fondear(address quien, uint256 monto) internal {
        address[] memory d = new address[](1);
        uint256[] memory m = new uint256[](1);
        d[0] = quien;
        m[0] = monto;
        cop.mintLote(d, m);
    }

    function _donar(CampanaEmergencia c, address donante, uint256 monto) internal {
        _fondear(donante, monto);
        vm.startPrank(donante);
        cop.approve(address(c), monto);
        c.donar(monto);
        vm.stopPrank();
    }

    function _donante(uint256 i) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encode("donante", i)))));
    }

    /// @dev 50 donantes con montos variados que suman exactamente la meta.
    function _donar50(CampanaEmergencia c) internal returns (address[] memory ds, uint256[] memory ms) {
        ds = new address[](50);
        ms = new uint256[](50);
        uint256 acumulado;
        for (uint256 i = 0; i < 50; i++) {
            ds[i] = _donante(i);
            ms[i] = i < 49 ? 100_000 ether + i * 3000 ether : META - acumulado;
            acumulado += ms[i];
            _donar(c, ds[i], ms[i]);
        }
    }

    function _proponer(CampanaEmergencia c, uint256 id, address proveedor) internal {
        vm.prank(fundacion);
        c.proponerDesembolso(id, proveedor, FACTURA, "", 0);
    }

    /// @dev Los verificadores 1 y 2 confirman y cuentan en campo lo mismo que dice la factura.
    function _aprobar(CampanaEmergencia c, uint256 id) internal {
        uint32 unidades = c.etapa(id).unidades;
        vm.prank(verificador1);
        c.confirmarEntrega(id, ACTA, "", unidades);
        vm.prank(verificador2);
        c.confirmarEntrega(id, ACTA, "", unidades);
    }

    function _rechazar(CampanaEmergencia c, uint256 id) internal {
        vm.prank(verificador1);
        c.rechazarEtapa(id, MOTIVO, "");
        vm.prank(verificador3);
        c.rechazarEtapa(id, MOTIVO, "");
    }
}
