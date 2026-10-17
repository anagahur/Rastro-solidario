// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

interface ICampanaFactory {
    function esCampana(address campana) external view returns (bool);
}

interface ICampanaLectura {
    function nombre() external view returns (string memory);
    function aportes(address donante) external view returns (uint256);
}

/// @title ReciboDonacion
/// @notice NFT de recibo (intransferible) que recibe cada donante en su primera donación a una
///         campaña. Su metadata se genera en la cadena y enlaza al rastreo de su dinero.
contract ReciboDonacion is ERC721, Ownable {
    using Strings for uint256;
    using Strings for address;

    struct Datos {
        address campana;
        address donante;
        uint64 fecha;
    }

    ICampanaFactory public factory;
    /// @notice URL del frontend, p. ej. "https://rastro-solidario.vercel.app/". Se le agrega
    ///         "#/rastreo/<campaña>/<donante>".
    string public urlBase;
    uint256 public totalEmitidos;
    mapping(uint256 => Datos) public datosRecibo;

    error FactoryYaConfigurada();
    error SoloCampanas();
    error Intransferible();

    constructor(address owner_) ERC721("Recibo de Donacion - Rastro Solidario", "RECIBO") Ownable(owner_) { }

    /// @notice Se configura una única vez (la factory necesita la dirección del recibo y viceversa).
    function configurarFactory(ICampanaFactory factory_) external onlyOwner {
        if (address(factory) != address(0)) revert FactoryYaConfigurada();
        factory = factory_;
    }

    function configurarUrlBase(string calldata url) external onlyOwner {
        urlBase = url;
    }

    function emitirRecibo(address donante) external returns (uint256 id) {
        if (address(factory) == address(0) || !factory.esCampana(msg.sender)) revert SoloCampanas();
        id = ++totalEmitidos;
        datosRecibo[id] = Datos({ campana: msg.sender, donante: donante, fecha: uint64(block.timestamp) });
        _mint(donante, id);
    }

    /// @dev Intransferible: solo se permite acuñar (from == 0).
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Intransferible();
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Datos memory d = datosRecibo[tokenId];
        string memory nombreCampana = ICampanaLectura(d.campana).nombre();
        string memory aporte = _pesos(ICampanaLectura(d.campana).aportes(d.donante));
        string memory enlace = string.concat(
            urlBase, "#/rastreo/", d.campana.toHexString(), "/", d.donante.toHexString()
        );

        string memory json = string.concat(
            '{"name":"Recibo de donacion #',
            tokenId.toString(),
            '","description":"Recibo intransferible. Sigue cada peso de tu donacion en el enlace.",',
            '"external_url":"',
            enlace,
            '","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(_svg(tokenId, _xml(nombreCampana), aporte))),
            '","attributes":[{"trait_type":"Campana","value":"',
            _json(nombreCampana),
            '"},{"trait_type":"Aporte MockCOP","value":"',
            aporte,
            '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _svg(uint256 tokenId, string memory nombreCampana, string memory aporte)
        private
        pure
        returns (string memory)
    {
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">',
            '<rect width="400" height="240" rx="18" fill="#0f2e2a"/>',
            '<rect x="12" y="12" width="376" height="216" rx="12" fill="none" stroke="#5eead4" stroke-width="1.5"/>',
            '<text x="32" y="52" font-family="sans-serif" font-size="14" fill="#99f6e4">RECIBO DE DONACION #',
            tokenId.toString(),
            "</text>",
            '<text x="32" y="96" font-family="sans-serif" font-size="18" font-weight="bold" fill="#ffffff">',
            nombreCampana,
            "</text>",
            '<text x="32" y="150" font-family="sans-serif" font-size="30" font-weight="bold" fill="#5eead4">$',
            aporte,
            "</text>",
            '<text x="32" y="176" font-family="sans-serif" font-size="13" fill="#99f6e4">MockCOP donados</text>',
            '<text x="32" y="210" font-family="sans-serif" font-size="12" fill="#ccfbf1">Rastro Solidario - Monad</text>',
            "</svg>"
        );
    }

    /// @dev Formatea un monto de 18 decimales como pesos enteros con puntos de miles: 200.000
    function _pesos(uint256 monto) private pure returns (string memory) {
        bytes memory s = bytes((monto / 1 ether).toString());
        uint256 len = s.length;
        uint256 puntos = (len - 1) / 3;
        bytes memory out = new bytes(len + puntos);
        uint256 j = out.length;
        for (uint256 i = 0; i < len; i++) {
            if (i > 0 && i % 3 == 0) out[--j] = ".";
            out[--j] = s[len - 1 - i];
        }
        return string(out);
    }

    /// @dev Escapa texto para meterlo dentro de un SVG.
    function _xml(string memory texto) private pure returns (string memory r) {
        bytes memory b = bytes(texto);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c == "<") r = string.concat(r, "&lt;");
            else if (c == ">") r = string.concat(r, "&gt;");
            else if (c == "&") r = string.concat(r, "&amp;");
            else if (c == '"') r = string.concat(r, "&quot;");
            else if (c == "'") r = string.concat(r, "&apos;");
            else r = string.concat(r, string(abi.encodePacked(c)));
        }
    }

    /// @dev Escapa texto para meterlo dentro de un string JSON.
    function _json(string memory texto) private pure returns (string memory r) {
        bytes memory b = bytes(texto);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c == '"' || c == "\\") r = string.concat(r, "\\", string(abi.encodePacked(c)));
            else if (uint8(c) < 0x20) r = string.concat(r, " ");
            else r = string.concat(r, string(abi.encodePacked(c)));
        }
    }
}
