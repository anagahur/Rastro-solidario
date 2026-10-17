// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { BaseTest } from "./utils/BaseTest.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MockCOP } from "../src/MockCOP.sol";
import { RegistroActores } from "../src/RegistroActores.sol";
import { ReciboDonacion, ICampanaFactory } from "../src/ReciboDonacion.sol";
import { CampanaFactory } from "../src/CampanaFactory.sol";
import { CampanaEmergencia, IReciboDonacion } from "../src/CampanaEmergencia.sol";
import { Dispersor } from "../src/Dispersor.sol";

/// @notice Tests de MockCOP, RegistroActores, CampanaFactory, ReciboDonacion y Dispersor.
contract SistemaTest is BaseTest {
    // ═══════════════════════ MockCOP ═══════════════════════

    function test_Faucet() public {
        vm.prank(intruso);
        cop.faucet();
        assertEq(cop.balanceOf(intruso), cop.MONTO_FAUCET());
        assertEq(cop.symbol(), "MockCOP");
    }

    function test_RevertSi_MintLoteNoOwner() public {
        address[] memory d = new address[](1);
        uint256[] memory m = new uint256[](1);
        vm.prank(intruso);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, intruso));
        cop.mintLote(d, m);
    }

    function test_RevertSi_MintLoteLongitudes() public {
        vm.expectRevert(MockCOP.LongitudesDistintas.selector);
        cop.mintLote(new address[](2), new uint256[](1));
    }

    // ═══════════════════════ RegistroActores ═══════════════════════

    function test_RegistroYListado() public view {
        assertTrue(registro.esFundacion(fundacion));
        assertTrue(registro.esVerificador(verificador1));
        assertTrue(registro.esProveedor(supermercado));
        assertFalse(registro.esProveedor(intruso));
        assertEq(registro.nombre(supermercado), "Supermercado La Economia");

        (address[] memory cuentas, string[] memory nombres) = registro.actores(registro.PROVEEDOR_ROLE());
        assertEq(cuentas.length, 3);
        assertEq(cuentas[0], supermercado);
        assertEq(nombres[1], "Ferreteria El Constructor");
    }

    function test_Revocar() public {
        registro.revocarActor(registro.PROVEEDOR_ROLE(), supermercado);
        assertFalse(registro.esProveedor(supermercado));
        (address[] memory cuentas,) = registro.actores(registro.PROVEEDOR_ROLE());
        assertEq(cuentas.length, 2);
    }

    function test_RevertSi_RegistraQuienNoEsAdmin() public {
        bytes32 rol = registro.PROVEEDOR_ROLE();
        bytes32 adminRole = registro.DEFAULT_ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, fundacion, adminRole
            )
        );
        vm.prank(fundacion);
        registro.registrarActor(rol, intruso, "Proveedor falso");
    }

    function test_RevertSi_RolInvalido() public {
        bytes32 adminRole = registro.DEFAULT_ADMIN_ROLE();
        vm.expectRevert(abi.encodeWithSelector(RegistroActores.RolInvalido.selector, adminRole));
        registro.registrarActor(adminRole, intruso, "x");
    }

    function test_RevertSi_DatosInvalidos() public {
        bytes32 rol = registro.PROVEEDOR_ROLE();
        vm.expectRevert(RegistroActores.CuentaInvalida.selector);
        registro.registrarActor(rol, address(0), "x");
        vm.expectRevert(RegistroActores.NombreVacio.selector);
        registro.registrarActor(rol, intruso, "");
    }

    // ═══════════════════════ CampanaFactory ═══════════════════════

    function test_FactoryCreaYLista() public {
        CampanaEmergencia c1 = _crearCampana();
        CampanaEmergencia c2 = _crearCampana();
        assertEq(factory.numeroCampanas(), 2);
        assertTrue(factory.esCampana(address(c1)));
        assertEq(factory.campanas()[1], address(c2));
        assertEq(c1.fundacion(), fundacion);
        assertFalse(factory.esCampana(intruso));
    }

    function test_RevertSi_CreaQuienNoEsFundacion() public {
        CampanaEmergencia.ConfigCampana memory cfg = _config();
        vm.prank(intruso);
        vm.expectRevert(CampanaFactory.SoloFundacion.selector);
        factory.crearCampana(cfg);
    }

    function _esperarConfigInvalida(CampanaEmergencia.ConfigCampana memory cfg, string memory motivo)
        internal
    {
        vm.prank(fundacion);
        vm.expectRevert(abi.encodeWithSelector(CampanaEmergencia.ConfigInvalida.selector, motivo));
        factory.crearCampana(cfg);
    }

    function test_RevertSi_PorcentajesNoSuman100() public {
        CampanaEmergencia.ConfigCampana memory cfg = _config();
        cfg.porcentajesBps[2] = 2999;
        _esperarConfigInvalida(cfg, "porcentajes deben sumar 100%");
    }

    function test_RevertSi_UmbralInvalido() public {
        CampanaEmergencia.ConfigCampana memory cfg = _config();
        cfg.umbral = 1;
        _esperarConfigInvalida(cfg, "umbral");
        cfg.umbral = 4;
        _esperarConfigInvalida(cfg, "umbral");
    }

    function test_RevertSi_VerificadorNoRegistrado() public {
        CampanaEmergencia.ConfigCampana memory cfg = _config();
        cfg.verificadores[2] = intruso;
        _esperarConfigInvalida(cfg, "verificador no registrado");
    }

    function test_RevertSi_VerificadorRepetido() public {
        CampanaEmergencia.ConfigCampana memory cfg = _config();
        cfg.verificadores[2] = verificador1;
        _esperarConfigInvalida(cfg, "verificador repetido");
    }

    function test_RevertSi_FundacionComoVerificador() public {
        registro.registrarActor(registro.VERIFICADOR_ROLE(), fundacion, "Fundacion verificadora");
        CampanaEmergencia.ConfigCampana memory cfg = _config();
        cfg.verificadores[0] = fundacion;
        _esperarConfigInvalida(cfg, "verificador");
    }

    function test_RevertSi_MetaCeroOEtapasVacias() public {
        CampanaEmergencia.ConfigCampana memory cfg = _config();
        cfg.meta = 0;
        _esperarConfigInvalida(cfg, "meta");

        cfg = _config();
        cfg.descripcionesEtapas = new string[](0);
        _esperarConfigInvalida(cfg, "numero de etapas");

        cfg = _config();
        cfg.plazosEtapas = new uint64[](2);
        _esperarConfigInvalida(cfg, "longitudes de etapas");
    }

    function test_CampanaDirecta_SinFundacionRegistradaRevierte() public {
        vm.expectRevert(
            abi.encodeWithSelector(CampanaEmergencia.ConfigInvalida.selector, "fundacion no registrada")
        );
        new CampanaEmergencia(_dep(IReciboDonacion(address(0))), intruso, _config());
    }

    // ═══════════════════════ ReciboDonacion (NFT) ═══════════════════════

    function test_ReciboSeEmiteEnPrimeraDonacion() public {
        CampanaEmergencia c = _crearCampana();
        address d = makeAddr("d");
        _donar(c, d, 200_000 ether);
        uint256 id = c.reciboDe(d);
        assertEq(id, 1);
        assertEq(recibo.ownerOf(id), d);
        (address campana, address donante,) = recibo.datosRecibo(id);
        assertEq(campana, address(c));
        assertEq(donante, d);
    }

    function test_ReciboTokenURI() public {
        CampanaEmergencia c = _crearCampana();
        address d = makeAddr("d");
        _donar(c, d, 200_000 ether);
        // data:application/json;base64,<...>
        string memory json = _decode(_sinPrefijo(recibo.tokenURI(1)));
        assertTrue(vm.contains(json, "Recibo de donacion #1"));
        assertTrue(vm.contains(json, "200.000"));
        assertTrue(vm.contains(json, "Inundacion en Antioquia"));
        assertTrue(vm.contains(json, "https://rastro.test/#/rastreo/"));
    }

    function test_ReciboEscapaNombresPeligrosos() public {
        CampanaEmergencia.ConfigCampana memory cfg = _config();
        cfg.nombre = 'Lluvias "Uraba" <norte>';
        CampanaEmergencia c = _crearCampana(cfg);
        _donar(c, makeAddr("d"), 1000 ether);
        string memory json = _decode(_sinPrefijo(recibo.tokenURI(1)));
        assertTrue(vm.contains(json, 'Lluvias \\"Uraba\\" <norte>'), "JSON escapado");
    }

    function test_RevertSi_ReciboSeTransfiere() public {
        CampanaEmergencia c = _crearCampana();
        address d = makeAddr("d");
        _donar(c, d, 1000 ether);
        vm.prank(d);
        vm.expectRevert(ReciboDonacion.Intransferible.selector);
        recibo.transferFrom(d, intruso, 1);
    }

    function test_RevertSi_EmiteReciboQuienNoEsCampana() public {
        vm.prank(intruso);
        vm.expectRevert(ReciboDonacion.SoloCampanas.selector);
        recibo.emitirRecibo(intruso);
    }

    function test_RevertSi_ReconfiguraFactory() public {
        vm.expectRevert(ReciboDonacion.FactoryYaConfigurada.selector);
        recibo.configurarFactory(ICampanaFactory(intruso));
    }

    function test_DonacionFuncionaAunqueElReciboFalle() public {
        // Campaña creada fuera de la factory: el recibo rechaza la emisión, pero la donación pasa.
        CampanaEmergencia c = new CampanaEmergencia(_dep(IReciboDonacion(address(recibo))), fundacion, _config());
        address d = makeAddr("d");
        _donar(c, d, 1000 ether);
        assertEq(c.aportes(d), 1000 ether);
        assertEq(c.reciboDe(d), 0);
        assertEq(recibo.balanceOf(d), 0);
    }

    // ═══════════════════════ Dispersor ═══════════════════════

    function test_Dispersor() public {
        Dispersor disp = new Dispersor();
        address[] memory d = new address[](3);
        uint256[] memory m = new uint256[](3);
        for (uint256 i = 0; i < 3; i++) {
            d[i] = _donante(i);
            m[i] = (i + 1) * 0.1 ether;
        }
        disp.dispersar{ value: 0.6 ether }(d, m);
        assertEq(d[2].balance, 0.3 ether);

        vm.expectRevert(Dispersor.ValorIncorrecto.selector);
        disp.dispersar{ value: 0.5 ether }(d, m);
    }

    // ───────────── utilidades ─────────────

    function _sinPrefijo(string memory uri) internal pure returns (string memory) {
        bytes memory u = bytes(uri);
        uint256 p = bytes("data:application/json;base64,").length;
        bytes memory r = new bytes(u.length - p);
        for (uint256 i = 0; i < r.length; i++) {
            r[i] = u[i + p];
        }
        return string(r);
    }

    /// @dev Decodificador base64 mínimo para leer la metadata en los tests.
    function _decode(string memory data) internal pure returns (string memory) {
        bytes memory tabla = bytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
        bytes memory d = bytes(data);
        uint8[128] memory rev;
        for (uint8 i = 0; i < 64; i++) {
            rev[uint8(tabla[i])] = i;
        }
        uint256 pad = 0;
        if (d.length > 0 && d[d.length - 1] == "=") pad++;
        if (d.length > 1 && d[d.length - 2] == "=") pad++;
        bytes memory out = new bytes((d.length / 4) * 3 - pad);
        uint256 j;
        for (uint256 i = 0; i < d.length; i += 4) {
            uint256 n = (uint256(rev[uint8(d[i])]) << 18) | (uint256(rev[uint8(d[i + 1])]) << 12)
                | (uint256(d[i + 2] == "=" ? 0 : rev[uint8(d[i + 2])]) << 6)
                | uint256(d[i + 3] == "=" ? 0 : rev[uint8(d[i + 3])]);
            if (j < out.length) out[j++] = bytes1(uint8(n >> 16));
            if (j < out.length) out[j++] = bytes1(uint8(n >> 8));
            if (j < out.length) out[j++] = bytes1(uint8(n));
        }
        return string(out);
    }
}
