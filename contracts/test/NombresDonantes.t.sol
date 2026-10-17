// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { BaseTest } from "./utils/BaseTest.sol";
import { CampanaEmergencia } from "../src/CampanaEmergencia.sol";
import { NombresDonantes, ICampanaFactoryNombres } from "../src/NombresDonantes.sol";
import { ERC2771Forwarder } from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Cada donante elige si aparece anónimo o con su nombre en la página pública.
contract NombresDonantesTest is BaseTest {
    bytes32 internal constant FORWARD_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
    );

    NombresDonantes internal nombresDonantes;
    CampanaEmergencia internal campana;
    address internal donante = makeAddr("donante");

    function setUp() public override {
        super.setUp();
        nombresDonantes = new NombresDonantes(ICampanaFactoryNombres(address(factory)), address(reenviador), admin);
        campana = _crearCampana();
        _donar(campana, donante, 20_000 ether);
    }

    function test_PorDefectoEsAnonimo() public view {
        assertEq(nombresDonantes.nombrePublico(address(campana), donante), "");
    }

    function test_DonanteMuestraYOcultaSuNombre() public {
        vm.expectEmit(true, true, false, true);
        emit NombresDonantes.NombrePublico(address(campana), donante, unicode"María G.");
        vm.prank(donante);
        nombresDonantes.mostrarNombre(address(campana), unicode"María G.");
        assertEq(nombresDonantes.nombrePublico(address(campana), donante), unicode"María G.");

        vm.prank(donante);
        nombresDonantes.ocultarNombre(address(campana));
        assertEq(nombresDonantes.nombrePublico(address(campana), donante), "");
    }

    function test_SoloQuienDonoPuedePonerNombre() public {
        vm.prank(intruso);
        vm.expectRevert(NombresDonantes.NoEsDonante.selector);
        nombresDonantes.mostrarNombre(address(campana), "Suplantador");
    }

    function test_SoloCampanasOficiales() public {
        vm.prank(donante);
        vm.expectRevert(NombresDonantes.CampanaNoOficial.selector);
        nombresDonantes.mostrarNombre(address(cop), "Nombre");
    }

    function test_NombreVacioLargoOConSaltosDeLineaNoSeAcepta() public {
        vm.startPrank(donante);
        vm.expectRevert(NombresDonantes.NombreInvalido.selector);
        nombresDonantes.mostrarNombre(address(campana), "");
        vm.expectRevert(NombresDonantes.NombreInvalido.selector);
        nombresDonantes.mostrarNombre(address(campana), "Nombre larguisimo que pasa de los sesenta bytes que se permiten");
        vm.expectRevert(NombresDonantes.NombreInvalido.selector);
        nombresDonantes.mostrarNombre(address(campana), "Linea 1\nLinea 2");
        vm.stopPrank();
    }

    function test_ElNombreEsPorCampana() public {
        CampanaEmergencia otra = _crearCampana();
        _donar(otra, donante, 5_000 ether);
        vm.prank(donante);
        nombresDonantes.mostrarNombre(address(campana), "Ana");
        assertEq(nombresDonantes.nombrePublico(address(otra), donante), "");
    }

    function test_AdminModeraPeroNoPoneNombres() public {
        vm.prank(donante);
        nombresDonantes.mostrarNombre(address(campana), "Texto ofensivo");
        nombresDonantes.moderar(address(campana), donante);
        assertEq(nombresDonantes.nombrePublico(address(campana), donante), "");

        // El admin no donó: no puede publicar un nombre a su nombre ni a nombre de otro
        vm.expectRevert(NombresDonantes.NoEsDonante.selector);
        nombresDonantes.mostrarNombre(address(campana), "Admin");

        vm.prank(intruso);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, intruso));
        nombresDonantes.moderar(address(campana), donante);
    }

    function test_NombresEnLote() public {
        address otro = makeAddr("otroDonante");
        _donar(campana, otro, 1_000 ether);
        vm.prank(donante);
        nombresDonantes.mostrarNombre(address(campana), "Ana");
        address[] memory ds = new address[](2);
        ds[0] = donante;
        ds[1] = otro;
        string[] memory ns = nombresDonantes.nombres(address(campana), ds);
        assertEq(ns[0], "Ana");
        assertEq(ns[1], "");
    }

    /// @dev Quien donó con Nequi/PSE (billetera invisible) firma y el patrocinador paga el gas.
    function test_SinGasConElReenviador() public {
        uint256 llave = uint256(keccak256("billetera invisible"));
        address invisible = vm.addr(llave);
        _donar(campana, invisible, 10_000 ether);

        bytes memory data = abi.encodeCall(NombresDonantes.mostrarNombre, (address(campana), unicode"Familia Pérez"));
        ERC2771Forwarder.ForwardRequestData memory req = _firmarReenvio(llave, address(nombresDonantes), data, 200_000);
        address patrocinador = makeAddr("patrocinador");
        vm.prank(patrocinador);
        reenviador.execute(req);

        assertEq(nombresDonantes.nombrePublico(address(campana), invisible), unicode"Familia Pérez");
        assertEq(nombresDonantes.nombrePublico(address(campana), patrocinador), "");
    }

    function _firmarReenvio(uint256 llave, address to, bytes memory data, uint256 gas)
        internal
        view
        returns (ERC2771Forwarder.ForwardRequestData memory req)
    {
        address from = vm.addr(llave);
        uint48 deadline = uint48(block.timestamp + 1 hours);
        bytes32 structHash = keccak256(
            abi.encode(FORWARD_TYPEHASH, from, to, uint256(0), gas, reenviador.nonces(from), deadline, keccak256(data))
        );
        bytes32 dominio = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Rastro Solidario"),
                keccak256("1"),
                block.chainid,
                address(reenviador)
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(llave, keccak256(abi.encodePacked("\x19\x01", dominio, structHash)));
        req = ERC2771Forwarder.ForwardRequestData({
            from: from, to: to, value: 0, gas: gas, deadline: deadline, data: data, signature: abi.encodePacked(r, s, v)
        });
    }
}
