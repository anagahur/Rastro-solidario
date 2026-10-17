// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Context } from "@openzeppelin/contracts/utils/Context.sol";

interface ICampanaFactoryNombres {
    function esCampana(address campana) external view returns (bool);
}

interface ICampanaAportes {
    function aportes(address donante) external view returns (uint256);
}

/// @title NombresDonantes
/// @notice Cada donante decide cómo aparece en la página pública de una campaña: anónimo (por
///         defecto) o con el nombre que él mismo escriba, y puede volver a anónimo cuando quiera.
///         Solo se guarda ese nombre público: los datos de la constancia de donación (cédula o
///         NIT) se quedan en el PDF y en el celular de la persona, nunca en la cadena.
/// @dev Contrato aparte para no tocar las campañas ya desplegadas. Acepta gas patrocinado
///      (ERC-2771) con el mismo ReenviadorGas: quien donó con Nequi/PSE no paga nada.
contract NombresDonantes is ERC2771Context, Ownable {
    /// @notice Largo máximo del nombre público en bytes (≈ 60 letras sin tildes).
    uint256 public constant MAX_BYTES_NOMBRE = 60;

    ICampanaFactoryNombres public immutable factory;

    /// @notice Nombre público de cada donante en cada campaña ("" = anónimo).
    mapping(address campana => mapping(address donante => string)) public nombrePublico;

    event NombrePublico(address indexed campana, address indexed donante, string nombre);
    event NombreOcultado(address indexed campana, address indexed donante, bool porModeracion);

    error CampanaNoOficial();
    error NoEsDonante();
    error NombreInvalido();

    constructor(ICampanaFactoryNombres factory_, address reenviador, address owner_)
        ERC2771Context(reenviador)
        Ownable(owner_)
    {
        factory = factory_;
    }

    /// @notice Muestra `nombre` en la página pública de `campana`. Solo para quien donó a ella.
    function mostrarNombre(address campana, string calldata nombre) external {
        address donante = _msgSender();
        if (!factory.esCampana(campana)) revert CampanaNoOficial();
        if (ICampanaAportes(campana).aportes(donante) == 0) revert NoEsDonante();
        bytes calldata b = bytes(nombre);
        if (b.length == 0 || b.length > MAX_BYTES_NOMBRE) revert NombreInvalido();
        for (uint256 i = 0; i < b.length; i++) {
            // Sin saltos de línea ni caracteres de control
            if (uint8(b[i]) < 0x20 || uint8(b[i]) == 0x7f) revert NombreInvalido();
        }
        nombrePublico[campana][donante] = nombre;
        emit NombrePublico(campana, donante, nombre);
    }

    /// @notice Vuelve a aparecer como anónimo en `campana`.
    function ocultarNombre(address campana) external {
        address donante = _msgSender();
        delete nombrePublico[campana][donante];
        emit NombreOcultado(campana, donante, false);
    }

    /// @notice El administrador puede retirar un nombre ofensivo. No puede poner ni cambiar uno.
    function moderar(address campana, address donante) external onlyOwner {
        delete nombrePublico[campana][donante];
        emit NombreOcultado(campana, donante, true);
    }

    /// @notice Nombres públicos de varios donantes de una campaña ("" = anónimo), en una llamada.
    function nombres(address campana, address[] calldata donantes) external view returns (string[] memory lista) {
        lista = new string[](donantes.length);
        for (uint256 i = 0; i < donantes.length; i++) {
            lista[i] = nombrePublico[campana][donantes[i]];
        }
    }

    // Ownable usa Context; con ERC-2771 el remitente es quien firmó, no el patrocinador.
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
