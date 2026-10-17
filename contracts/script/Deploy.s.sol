// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { MockCOP } from "../src/MockCOP.sol";
import { RegistroActores } from "../src/RegistroActores.sol";
import { ReciboDonacion, ICampanaFactory } from "../src/ReciboDonacion.sol";
import { CampanaFactory } from "../src/CampanaFactory.sol";
import { IReciboDonacion } from "../src/CampanaEmergencia.sol";
import {
    HistorialReputacion,
    IHistorialReputacion,
    ICampanaFactoryReputacion
} from "../src/HistorialReputacion.sol";
import { ReenviadorGas } from "../src/ReenviadorGas.sol";
import { Dispersor } from "../src/Dispersor.sol";
import { NombresDonantes, ICampanaFactoryNombres } from "../src/NombresDonantes.sol";

/// @notice Despliega todo el sistema y registra los actores de la demo.
///
///  Variables de entorno (.env en la raíz):
///   DEPLOYER_PRIVATE_KEY  quien despliega y queda como admin del registro (necesita MON)
///   SIM_MNEMONIC          de aquí salen las wallets simuladas de los actores:
///                           índice 1 = fundación, 2..4 = verificadores, 5..7 = proveedores,
///                           8 = empresa aliada (matching), 9 = patrocinador de gas
///                         En Anvil se usa el mnemónico de prueba si no está definido.
///   FRONTEND_URL          URL del frontend para el enlace del NFT de recibo
contract Deploy is Script {
    string internal constant MNEMONIC_ANVIL =
        "test test test test test test test test test test test junk";
    uint256 internal constant PK_ANVIL_0 =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    struct Desplegado {
        MockCOP cop;
        RegistroActores registro;
        ReciboDonacion recibo;
        CampanaFactory factory;
        HistorialReputacion reputacion;
        ReenviadorGas reenviador;
        Dispersor dispersor;
        NombresDonantes nombres;
    }

    function run() external {
        // En Anvil siempre se usan las cuentas de prueba públicas (aunque .env tenga las de Monad).
        bool esLocal = block.chainid == 31_337;
        uint256 deployerPk = esLocal ? PK_ANVIL_0 : vm.envUint("DEPLOYER_PRIVATE_KEY");
        string memory mnemonic =
            esLocal ? MNEMONIC_ANVIL : vm.envOr("SIM_MNEMONIC", string(""));
        require(bytes(mnemonic).length > 0, "Falta SIM_MNEMONIC en .env: ejecuta `pnpm wallets:nuevo`");
        string memory frontendUrl = vm.envOr("FRONTEND_URL", string("http://localhost:5173/"));

        address deployer = vm.addr(deployerPk);
        address fundacion = vm.addr(vm.deriveKey(mnemonic, 1));
        address[3] memory verificadores = [
            vm.addr(vm.deriveKey(mnemonic, 2)),
            vm.addr(vm.deriveKey(mnemonic, 3)),
            vm.addr(vm.deriveKey(mnemonic, 4))
        ];
        address[3] memory proveedores = [
            vm.addr(vm.deriveKey(mnemonic, 5)),
            vm.addr(vm.deriveKey(mnemonic, 6)),
            vm.addr(vm.deriveKey(mnemonic, 7))
        ];
        address empresa = vm.addr(vm.deriveKey(mnemonic, 8));
        address patrocinador = vm.addr(vm.deriveKey(mnemonic, 9));

        vm.startBroadcast(deployerPk);
        Desplegado memory d;
        d.cop = new MockCOP();
        d.registro = new RegistroActores(deployer);
        d.recibo = new ReciboDonacion(deployer);
        d.reputacion = new HistorialReputacion(deployer);
        d.reenviador = new ReenviadorGas();
        d.factory = new CampanaFactory(
            d.cop,
            d.registro,
            IReciboDonacion(address(d.recibo)),
            IHistorialReputacion(address(d.reputacion)),
            address(d.reenviador)
        );
        d.recibo.configurarFactory(ICampanaFactory(address(d.factory)));
        d.reputacion.configurarFactory(ICampanaFactoryReputacion(address(d.factory)));
        d.recibo.configurarUrlBase(frontendUrl);
        d.dispersor = new Dispersor();
        d.nombres = new NombresDonantes(ICampanaFactoryNombres(address(d.factory)), address(d.reenviador), deployer);

        bytes32 F = d.registro.FUNDACION_ROLE();
        bytes32 V = d.registro.VERIFICADOR_ROLE();
        bytes32 P = d.registro.PROVEEDOR_ROLE();
        d.registro.registrarActor(F, fundacion, unicode"Fundación Antioquia Solidaria");
        d.registro.registrarActor(V, verificadores[0], "Defensa Civil Antioquia");
        d.registro.registrarActor(V, verificadores[1], unicode"Junta de Acción Comunal");
        d.registro.registrarActor(V, verificadores[2], unicode"Personería Municipal");
        d.registro.registrarActor(P, proveedores[0], "Supermercado La Cosecha");
        d.registro.registrarActor(P, proveedores[1], unicode"Ferretería El Constructor");
        d.registro.registrarActor(P, proveedores[2], "Constructora Comunitaria");
        d.registro.registrarActor(
            d.registro.EMPRESA_ROLE(), empresa, "Aliados por Antioquia S.A.S."
        );
        vm.stopBroadcast();

        console2.log("=== Despliegue completo ===");
        console2.log("ChainId         :", block.chainid);
        console2.log("Deployer (admin):", deployer);
        console2.log("MockCOP         :", address(d.cop));
        console2.log("RegistroActores :", address(d.registro));
        console2.log("ReciboDonacion  :", address(d.recibo));
        console2.log("CampanaFactory  :", address(d.factory));
        console2.log("Reputacion      :", address(d.reputacion));
        console2.log("ReenviadorGas   :", address(d.reenviador));
        console2.log("Dispersor       :", address(d.dispersor));
        console2.log("NombresDonantes :", address(d.nombres));
        console2.log("Fundacion       :", fundacion);

        _escribirReporte(d, deployer, fundacion, verificadores, proveedores, empresa, patrocinador);
    }

    function _escribirReporte(
        Desplegado memory d,
        address deployer,
        address fundacion,
        address[3] memory verificadores,
        address[3] memory proveedores,
        address empresa,
        address patrocinador
    ) internal {
        string memory json = string.concat(
            "{\n",
            '  "chainId": ', vm.toString(block.chainid), ",\n",
            '  "bloqueDespliegue": ', vm.toString(block.number), ",\n",
            _par("deployer", deployer),
            _par("MockCOP", address(d.cop)),
            _par("RegistroActores", address(d.registro)),
            _par("ReciboDonacion", address(d.recibo))
        );
        json = string.concat(
            json,
            _par("CampanaFactory", address(d.factory)),
            _par("HistorialReputacion", address(d.reputacion)),
            _par("ReenviadorGas", address(d.reenviador)),
            _par("Dispersor", address(d.dispersor)),
            _par("NombresDonantes", address(d.nombres)),
            '  "actores": {\n',
            '    "fundacion": "', vm.toString(fundacion), '",\n'
        );
        json = string.concat(
            json,
            '    "verificadores": ', _lista(verificadores), ",\n",
            '    "proveedores": ', _lista(proveedores), ",\n",
            '    "empresa": "', vm.toString(empresa), '",\n',
            '    "patrocinador": "', vm.toString(patrocinador), '"\n',
            "  }\n}\n"
        );
        string memory ruta = string.concat("reports/deploy-", vm.toString(block.chainid), ".json");
        vm.writeFile(ruta, json);
        console2.log("Reporte guardado en:", ruta);
    }

    function _par(string memory clave, address valor) internal pure returns (string memory) {
        return string.concat('  "', clave, '": "', vm.toString(valor), '",\n');
    }

    function _lista(address[3] memory a) internal pure returns (string memory) {
        return string.concat(
            '["', vm.toString(a[0]), '", "', vm.toString(a[1]), '", "', vm.toString(a[2]), '"]'
        );
    }
}
