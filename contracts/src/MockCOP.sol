// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockCOP
/// @notice Peso colombiano simulado para pruebas. NO tiene valor real.
/// @dev Incluye ERC-2612 (permit) para que un donante pueda donar en UNA sola
///      transacción: firma el permiso fuera de la cadena (gratis) y el contrato de
///      la campaña lo usa. En Monad esto importa: las cuentas con poco saldo solo
///      pueden enviar una transacción cada 3 bloques (reserve balance).
contract MockCOP is ERC20, ERC20Permit, Ownable {
    /// @notice Cantidad que entrega el faucet por llamada: 500.000 MockCOP.
    uint256 public constant MONTO_FAUCET = 500_000 ether;

    error LongitudesDistintas();

    constructor() ERC20("Peso Colombiano Simulado", "MockCOP") ERC20Permit("MockCOP") Ownable(msg.sender) { }

    /// @notice Faucet abierto: cualquiera puede pedir saldo de prueba.
    function faucet() external {
        _mint(msg.sender, MONTO_FAUCET);
    }

    /// @notice Reparte saldo a muchas wallets en una sola transacción (script de simulación).
    function mintLote(address[] calldata destinos, uint256[] calldata montos) external onlyOwner {
        if (destinos.length != montos.length) revert LongitudesDistintas();
        for (uint256 i = 0; i < destinos.length; i++) {
            _mint(destinos[i], montos[i]);
        }
    }
}
