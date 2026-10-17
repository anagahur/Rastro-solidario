// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { RegistroActores } from "./RegistroActores.sol";
import { IHistorialReputacion } from "./HistorialReputacion.sol";
import { CampanaEmergencia, IReciboDonacion } from "./CampanaEmergencia.sol";

/// @title CampanaFactory
/// @notice Crea una campaña por emergencia. Solo las fundaciones registradas pueden crearlas,
///         y la fundación que llama queda como la proponente de esa campaña.
/// @dev Es la fuente de verdad de qué campañas son "oficiales": el frontend solo lista estas, el
///      NFT de recibo solo acepta emisiones de campañas creadas aquí, el historial de reputación
///      solo acepta reportes de ellas y el patrocinador de gas solo paga transacciones hacia ellas.
contract CampanaFactory {
    IERC20 public immutable token;
    RegistroActores public immutable registro;
    IReciboDonacion public immutable recibo;
    IHistorialReputacion public immutable reputacion;
    address public immutable reenviador;

    address[] private _campanas;
    mapping(address => bool) public esCampana;

    event CampanaCreada(
        address indexed campana, address indexed fundacion, string nombre, uint256 meta, uint256 indice
    );

    error SoloFundacion();

    constructor(
        IERC20 token_,
        RegistroActores registro_,
        IReciboDonacion recibo_,
        IHistorialReputacion reputacion_,
        address reenviador_
    ) {
        token = token_;
        registro = registro_;
        recibo = recibo_;
        reputacion = reputacion_;
        reenviador = reenviador_;
    }

    function crearCampana(CampanaEmergencia.ConfigCampana calldata cfg)
        external
        returns (address campana)
    {
        if (!registro.esFundacion(msg.sender)) revert SoloFundacion();
        CampanaEmergencia.Dependencias memory dep = CampanaEmergencia.Dependencias({
            token: token,
            registro: registro,
            recibo: recibo,
            reputacion: reputacion,
            reenviador: reenviador
        });
        campana = address(new CampanaEmergencia(dep, msg.sender, cfg));
        esCampana[campana] = true;
        _campanas.push(campana);
        reputacion.registrar(msg.sender, IHistorialReputacion.Evento.CampanaCreada, cfg.meta);
        emit CampanaCreada(campana, msg.sender, cfg.nombre, cfg.meta, _campanas.length - 1);
    }

    function numeroCampanas() external view returns (uint256) {
        return _campanas.length;
    }

    /// @notice Todas las campañas, de la más antigua a la más reciente.
    function campanas() external view returns (address[] memory) {
        return _campanas;
    }
}
