// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC2771Forwarder } from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/// @title ReenviadorGas
/// @notice Gas patrocinado (meta-transacciones ERC-2771). Quien no tiene cripto (un donante que
///         paga con Nequi/PSE, una familia damnificada que confirma con un QR) solo FIRMA lo que
///         quiere hacer; un patrocinador envía la transacción y paga el gas. Las campañas confían
///         en este reenviador y ven como remitente a quien firmó, no al patrocinador.
/// @dev Es el ERC2771Forwarder de OpenZeppelin sin cambios: verifica la firma EIP-712, el nonce
///      y el plazo de cada solicitud. El patrocinador no puede alterar lo que el usuario firmó.
contract ReenviadorGas is ERC2771Forwarder {
    constructor() ERC2771Forwarder("Rastro Solidario") { }
}
