// Solicitudes ERC-2771 firmadas (gas patrocinado): quien firma no necesita gas; el
// patrocinador las entrega al ReenviadorGas. El dominio EIP-712 es el del ERC2771Forwarder de
// OpenZeppelin con nombre "Rastro Solidario".

export const TIPOS_SOLICITUD = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
};

export const ABI_REENVIADOR_MIN = [
  { type: "function", name: "nonces", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
];

/**
 * @param {import("viem").LocalAccount} cuenta
 * @returns {Promise<{from,to,value,gas,deadline,data,signature}>} lista para execute / executeBatch
 */
export async function firmarSolicitud(cuenta, { reenviador, chainId, to, data, gas = 400_000n, nonce, deadline }) {
  const limite = deadline ?? Math.floor(Date.now() / 1000) + 3600;
  const signature = await cuenta.signTypedData({
    domain: { name: "Rastro Solidario", version: "1", chainId, verifyingContract: reenviador },
    types: TIPOS_SOLICITUD,
    primaryType: "ForwardRequest",
    message: { from: cuenta.address, to, value: 0n, gas, nonce, deadline: limite, data },
  });
  return { from: cuenta.address, to, value: 0n, gas, deadline: limite, data, signature };
}
