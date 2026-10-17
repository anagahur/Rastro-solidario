// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Dispersor
/// @notice Utilidad del script de simulación: reparte MON a muchas wallets en UNA transacción.
/// @dev En Monad, una cuenta con menos de 10 MON solo puede mandar una transacción cada
///      3 bloques, así que fondear 50 wallets una por una sería lento. Con esto es un solo tx.
contract Dispersor {
    error LongitudesDistintas();
    error ValorIncorrecto();
    error EnvioFallido(address destino);

    function dispersar(address[] calldata destinos, uint256[] calldata montos) external payable {
        if (destinos.length != montos.length) revert LongitudesDistintas();
        uint256 total;
        for (uint256 i = 0; i < montos.length; i++) {
            total += montos[i];
        }
        if (total != msg.value) revert ValorIncorrecto();
        for (uint256 i = 0; i < destinos.length; i++) {
            (bool ok,) = destinos[i].call{ value: montos[i] }("");
            if (!ok) revert EnvioFallido(destinos[i]);
        }
    }
}
