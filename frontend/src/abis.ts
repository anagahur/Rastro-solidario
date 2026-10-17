// Archivo generado por scripts/exportar-abis.mjs. No editar a mano.

export const mockCOPAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "DOMAIN_SEPARATOR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MONTO_FAUCET",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      {
        "name": "fields",
        "type": "bytes1",
        "internalType": "bytes1"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "version",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "extensions",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "faucet",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "mintLote",
    "inputs": [
      {
        "name": "destinos",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "montos",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nonces",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "permit",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "v",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "r",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "s",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignatureLength",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignatureS",
    "inputs": [
      {
        "name": "s",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InsufficientAllowance",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InsufficientBalance",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "balance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidApprover",
    "inputs": [
      {
        "name": "approver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidReceiver",
    "inputs": [
      {
        "name": "receiver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSender",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSpender",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC2612ExpiredSignature",
    "inputs": [
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC2612InvalidSigner",
    "inputs": [
      {
        "name": "signer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidAccountNonce",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "currentNonce",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidShortString",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LongitudesDistintas",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "str",
        "type": "string",
        "internalType": "string"
      }
    ]
  }
] as const;

export const registroActoresAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "admin",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "DEFAULT_ADMIN_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "EMPRESA_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "FUNDACION_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PROVEEDOR_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "VERIFICADOR_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "actores",
    "inputs": [
      {
        "name": "rol",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "cuentas",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "nombres",
        "type": "string[]",
        "internalType": "string[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "esEmpresa",
    "inputs": [
      {
        "name": "cuenta",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "esFundacion",
    "inputs": [
      {
        "name": "cuenta",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "esProveedor",
    "inputs": [
      {
        "name": "cuenta",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "esVerificador",
    "inputs": [
      {
        "name": "cuenta",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleAdmin",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleMember",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleMemberCount",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleMembers",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "grantRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hasRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nombre",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registrarActor",
    "inputs": [
      {
        "name": "rol",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "cuenta",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "nombreActor",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "callerConfirmation",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revocarActor",
    "inputs": [
      {
        "name": "rol",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "cuenta",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "name": "interfaceId",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ActorRegistrado",
    "inputs": [
      {
        "name": "rol",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "cuenta",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "nombre",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ActorRevocado",
    "inputs": [
      {
        "name": "rol",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "cuenta",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleAdminChanged",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "previousAdminRole",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "newAdminRole",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleGranted",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleRevoked",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AccessControlBadConfirmation",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessControlUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "neededRole",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "CuentaInvalida",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NombreVacio",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RolInvalido",
    "inputs": [
      {
        "name": "rol",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  }
] as const;

export const campanaFactoryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "token_",
        "type": "address",
        "internalType": "contract IERC20"
      },
      {
        "name": "registro_",
        "type": "address",
        "internalType": "contract RegistroActores"
      },
      {
        "name": "recibo_",
        "type": "address",
        "internalType": "contract IReciboDonacion"
      },
      {
        "name": "reputacion_",
        "type": "address",
        "internalType": "contract IHistorialReputacion"
      },
      {
        "name": "reenviador_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "campanas",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "crearCampana",
    "inputs": [
      {
        "name": "cfg",
        "type": "tuple",
        "internalType": "struct CampanaEmergencia.ConfigCampana",
        "components": [
          {
            "name": "nombre",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "descripcion",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "meta",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "duracionRecaudo",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "verificadores",
            "type": "address[]",
            "internalType": "address[]"
          },
          {
            "name": "umbral",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "descripcionesEtapas",
            "type": "string[]",
            "internalType": "string[]"
          },
          {
            "name": "porcentajesBps",
            "type": "uint16[]",
            "internalType": "uint16[]"
          },
          {
            "name": "plazosEtapas",
            "type": "uint64[]",
            "internalType": "uint64[]"
          },
          {
            "name": "preciosReferencia",
            "type": "uint256[]",
            "internalType": "uint256[]"
          },
          {
            "name": "unidadesReferencia",
            "type": "string[]",
            "internalType": "string[]"
          },
          {
            "name": "quorumBeneficiariosBps",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "campana",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "esCampana",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "numeroCampanas",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recibo",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IReciboDonacion"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "reenviador",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registro",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract RegistroActores"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "reputacion",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IHistorialReputacion"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "token",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "CampanaCreada",
    "inputs": [
      {
        "name": "campana",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "fundacion",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "nombre",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "meta",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "indice",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "SoloFundacion",
    "inputs": []
  }
] as const;

export const campanaEmergenciaAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "dep",
        "type": "tuple",
        "internalType": "struct CampanaEmergencia.Dependencias",
        "components": [
          {
            "name": "token",
            "type": "address",
            "internalType": "contract IERC20"
          },
          {
            "name": "registro",
            "type": "address",
            "internalType": "contract RegistroActores"
          },
          {
            "name": "recibo",
            "type": "address",
            "internalType": "contract IReciboDonacion"
          },
          {
            "name": "reputacion",
            "type": "address",
            "internalType": "contract IHistorialReputacion"
          },
          {
            "name": "reenviador",
            "type": "address",
            "internalType": "address"
          }
        ]
      },
      {
        "name": "fundacion_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "cfg",
        "type": "tuple",
        "internalType": "struct CampanaEmergencia.ConfigCampana",
        "components": [
          {
            "name": "nombre",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "descripcion",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "meta",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "duracionRecaudo",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "verificadores",
            "type": "address[]",
            "internalType": "address[]"
          },
          {
            "name": "umbral",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "descripcionesEtapas",
            "type": "string[]",
            "internalType": "string[]"
          },
          {
            "name": "porcentajesBps",
            "type": "uint16[]",
            "internalType": "uint16[]"
          },
          {
            "name": "plazosEtapas",
            "type": "uint64[]",
            "internalType": "uint64[]"
          },
          {
            "name": "preciosReferencia",
            "type": "uint256[]",
            "internalType": "uint256[]"
          },
          {
            "name": "unidadesReferencia",
            "type": "string[]",
            "internalType": "string[]"
          },
          {
            "name": "quorumBeneficiariosBps",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_BENEFICIARIOS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_ETAPAS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_LOTE_BENEFICIARIOS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_MATCHINGS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_PROPORCION_MATCHING_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_VERIFICADORES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "TOLERANCIA_SOBRECOSTO_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "activarReembolsoPorVencimiento",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "aportes",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "beneficiarios",
    "inputs": [
      {
        "name": "idEtapa",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "desde",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "cantidad",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "cuentas",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "confirmo",
        "type": "bool[]",
        "internalType": "bool[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "bloqueCreacion",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancelar",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cerrarRecaudo",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "comprometerMatching",
    "inputs": [
      {
        "name": "proporcionBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "tope",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "confirmarEntrega",
    "inputs": [
      {
        "name": "idEtapa",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "hashActa",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "uriActa",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "unidadesContadas",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "confirmarRecepcion",
    "inputs": [
      {
        "name": "idEtapa",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "descripcion",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "donaciones",
    "inputs": [
      {
        "name": "desde",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "cantidad",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "lista",
        "type": "tuple[]",
        "internalType": "struct CampanaEmergencia.RegistroDonacion[]",
        "components": [
          {
            "name": "donante",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "bloque",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "monto",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "fecha",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "donantes",
    "inputs": [
      {
        "name": "desde",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "cantidad",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "cuentas",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "montos",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "donar",
    "inputs": [
      {
        "name": "monto",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "donarConPermit",
    "inputs": [
      {
        "name": "monto",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "v",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "r",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "s",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "esBeneficiario",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "esEmpresaDeCampana",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "esVerificadorDeCampana",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "estado",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum CampanaEmergencia.EstadoCampana"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "etapa",
    "inputs": [
      {
        "name": "idEtapa",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct CampanaEmergencia.Etapa",
        "components": [
          {
            "name": "descripcion",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "porcentajeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "plazo",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fechaLimite",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "estado",
            "type": "uint8",
            "internalType": "enum CampanaEmergencia.EstadoEtapa"
          },
          {
            "name": "confirmaciones",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "rechazos",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "confirmacionesRequeridas",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "rechazosRequeridos",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "sobrecosto",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "unidadesNoCuadran",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "proveedor",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "monto",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "hashEvidencia",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "uriEvidencia",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "precioReferencia",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "unidad",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "unidades",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "confirmacionesBeneficiarios",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "beneficiariosRequeridos",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "bloquePropuesta",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fechaPropuesta",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "bloquePago",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fechaPago",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "etapaActual",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "etapas",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct CampanaEmergencia.Etapa[]",
        "components": [
          {
            "name": "descripcion",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "porcentajeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "plazo",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fechaLimite",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "estado",
            "type": "uint8",
            "internalType": "enum CampanaEmergencia.EstadoEtapa"
          },
          {
            "name": "confirmaciones",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "rechazos",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "confirmacionesRequeridas",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "rechazosRequeridos",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "sobrecosto",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "unidadesNoCuadran",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "proveedor",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "monto",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "hashEvidencia",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "uriEvidencia",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "precioReferencia",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "unidad",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "unidades",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "confirmacionesBeneficiarios",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "beneficiariosRequeridos",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "bloquePropuesta",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fechaPropuesta",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "bloquePago",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fechaPago",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "evidenciaVotoDe",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fechaCierreRecaudo",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fechaCreacion",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fechaRecaudoCerrado",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fechaReembolso",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fundacion",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "info",
    "inputs": [],
    "outputs": [
      {
        "name": "i",
        "type": "tuple",
        "internalType": "struct CampanaEmergencia.InfoCampana",
        "components": [
          {
            "name": "direccion",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nombre",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "descripcion",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "fundacion",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "token",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "meta",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalRecaudado",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalPagado",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalReembolsado",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "estado",
            "type": "uint8",
            "internalType": "enum CampanaEmergencia.EstadoCampana"
          },
          {
            "name": "motivoReembolso",
            "type": "uint8",
            "internalType": "enum CampanaEmergencia.MotivoReembolso"
          },
          {
            "name": "etapaActual",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "numeroEtapas",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "numeroDonantes",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "numeroDonaciones",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "fechaCierreRecaudo",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "bloqueCreacion",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "umbral",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "rechazosParaRechazar",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "verificadores",
            "type": "address[]",
            "internalType": "address[]"
          },
          {
            "name": "fechaCreacion",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fechaRecaudoCerrado",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fechaReembolso",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "quorumBeneficiariosBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "numeroBeneficiarios",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "matchingBloqueado",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "matchingUsado",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isTrustedForwarder",
    "inputs": [
      {
        "name": "forwarder",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "matchingBloqueado",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "matchingGenerado",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "matchingUsado",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "matchings",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct CampanaEmergencia.Matching[]",
        "components": [
          {
            "name": "empresa",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "proporcionBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "tope",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "usado",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "fecha",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "meta",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "montoReembolsado",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "motivoReembolso",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum CampanaEmergencia.MotivoReembolso"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nombre",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "numeroBeneficiarios",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "numeroDonaciones",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "numeroDonantes",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "numeroEtapas",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "parteDonanteEnEtapa",
    "inputs": [
      {
        "name": "donante",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "idEtapa",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "proponerDesembolso",
    "inputs": [
      {
        "name": "idEtapa",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "proveedor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "hashEvidencia",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "uriEvidencia",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "unidades",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "quorumBeneficiariosBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recepcionDe",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rechazarEtapa",
    "inputs": [
      {
        "name": "idEtapa",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "hashMotivo",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "uriMotivo",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rechazosParaRechazar",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recibo",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IReciboDonacion"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "reciboDe",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "reclamarReembolso",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reembolsoDisponible",
    "inputs": [
      {
        "name": "donante",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registrarBeneficiarios",
    "inputs": [
      {
        "name": "cuentas",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registro",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract RegistroActores"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "reputacion",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IHistorialReputacion"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "resumenDonante",
    "inputs": [
      {
        "name": "donante",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "r",
        "type": "tuple",
        "internalType": "struct CampanaEmergencia.ResumenDonante",
        "components": [
          {
            "name": "aporte",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalRecaudado",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "partePorEtapa",
            "type": "uint256[]",
            "internalType": "uint256[]"
          },
          {
            "name": "pagadoAProveedores",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "reembolsable",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "reembolsado",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "pendiente",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "recibo",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "matchingGenerado",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "token",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalPagado",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalRecaudado",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalReembolsado",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "trustedForwarder",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "umbral",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "unidadesContadasDe",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "uriVotoDe",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "verificadores",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "votoDe",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum CampanaEmergencia.Voto"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "votos",
    "inputs": [
      {
        "name": "idEtapa",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "listaVotos",
        "type": "uint8[]",
        "internalType": "enum CampanaEmergencia.Voto[]"
      },
      {
        "name": "evidencias",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "uris",
        "type": "string[]",
        "internalType": "string[]"
      },
      {
        "name": "unidadesContadas",
        "type": "uint32[]",
        "internalType": "uint32[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "BeneficiariosRegistrados",
    "inputs": [
      {
        "name": "verificador",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "cantidad",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "total",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CampanaFinalizada",
    "inputs": [
      {
        "name": "totalPagado",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DesembolsoPropuesto",
    "inputs": [
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "proveedor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "monto",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "hashEvidencia",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "uriEvidencia",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "sobrecosto",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Donacion",
    "inputs": [
      {
        "name": "donante",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "monto",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "aporteTotal",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "totalRecaudado",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EntregaConfirmada",
    "inputs": [
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "verificador",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "hashActa",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "uriActa",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "confirmaciones",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EtapaAprobada",
    "inputs": [
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EtapaRechazada",
    "inputs": [
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FondosLiberados",
    "inputs": [
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "proveedor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "monto",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MatchingAplicado",
    "inputs": [
      {
        "name": "empresa",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "donante",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "monto",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MatchingComprometido",
    "inputs": [
      {
        "name": "empresa",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "proporcionBps",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "tope",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MatchingDevuelto",
    "inputs": [
      {
        "name": "empresa",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "monto",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RecaudoCerrado",
    "inputs": [
      {
        "name": "totalRecaudado",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RecepcionConfirmada",
    "inputs": [
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "beneficiario",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "total",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ReembolsoActivado",
    "inputs": [
      {
        "name": "motivo",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum CampanaEmergencia.MotivoReembolso"
      },
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ReembolsoReclamado",
    "inputs": [
      {
        "name": "donante",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "monto",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SobrecostoDetectado",
    "inputs": [
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "precioUnitario",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "precioReferencia",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "UnidadesNoCuadran",
    "inputs": [
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "verificador",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "facturadas",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "contadas",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VotoRechazo",
    "inputs": [
      {
        "name": "etapa",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "verificador",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "hashMotivo",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "uriMotivo",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "rechazos",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BeneficiarioInvalido",
    "inputs": [
      {
        "name": "cuenta",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "CensoLleno",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ConfigInvalida",
    "inputs": [
      {
        "name": "motivo",
        "type": "string",
        "internalType": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "ConflictoDeInteres",
    "inputs": [
      {
        "name": "cuenta",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ConteoRequerido",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DemasiadosMatchings",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EstadoEtapaInvalido",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EstadoInvalido",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EtapaInvalida",
    "inputs": []
  },
  {
    "type": "error",
    "name": "HashVacio",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MatchingDuplicado",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MatchingInvalido",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MontoCero",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NadaQueReclamar",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoAutorizado",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoEsBeneficiario",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PermisoInvalido",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PlazoNoVencido",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PlazoVencido",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ProveedorNoAutorizado",
    "inputs": [
      {
        "name": "proveedor",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "RecaudoVencido",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "SinCenso",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SinFondos",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SoloEmpresa",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SoloFundacion",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SoloVerificador",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnidadesRequeridas",
    "inputs": []
  },
  {
    "type": "error",
    "name": "YaConfirmo",
    "inputs": []
  },
  {
    "type": "error",
    "name": "YaVoto",
    "inputs": []
  }
] as const;

export const reciboDonacionAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "owner_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "configurarFactory",
    "inputs": [
      {
        "name": "factory_",
        "type": "address",
        "internalType": "contract ICampanaFactory"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "configurarUrlBase",
    "inputs": [
      {
        "name": "url",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "datosRecibo",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "campana",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "donante",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "fecha",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "emitirRecibo",
    "inputs": [
      {
        "name": "donante",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "factory",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ICampanaFactory"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getApproved",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isApprovedForAll",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ownerOf",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "safeTransferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "safeTransferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setApprovalForAll",
    "inputs": [
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "approved",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "name": "interfaceId",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tokenURI",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalEmitidos",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "urlBase",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "approved",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ApprovalForAll",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "operator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "approved",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ERC721IncorrectOwner",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InsufficientApproval",
    "inputs": [
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidApprover",
    "inputs": [
      {
        "name": "approver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidOperator",
    "inputs": [
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidReceiver",
    "inputs": [
      {
        "name": "receiver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidSender",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721NonexistentToken",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "FactoryYaConfigurada",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Intransferible",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "SoloCampanas",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StringsInsufficientHexLength",
    "inputs": [
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  }
] as const;

export const historialReputacionAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "owner_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "configurarFactory",
    "inputs": [
      {
        "name": "factory_",
        "type": "address",
        "internalType": "contract ICampanaFactoryReputacion"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "factory",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ICampanaFactoryReputacion"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "historial",
    "inputs": [
      {
        "name": "actor",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct HistorialReputacion.Historial",
        "components": [
          {
            "name": "campanas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "finalizadas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "enReembolso",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "etapasPagadas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "etapasRechazadas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "etapasVencidas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "sobrecostos",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "votos",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "ultimaActividad",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "monto",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "historiales",
    "inputs": [
      {
        "name": "actores",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [
      {
        "name": "r",
        "type": "tuple[]",
        "internalType": "struct HistorialReputacion.Historial[]",
        "components": [
          {
            "name": "campanas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "finalizadas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "enReembolso",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "etapasPagadas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "etapasRechazadas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "etapasVencidas",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "sobrecostos",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "votos",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "ultimaActividad",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "monto",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "indiceConfianza",
    "inputs": [
      {
        "name": "actor",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "bps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "evaluadas",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registrar",
    "inputs": [
      {
        "name": "actor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "evento",
        "type": "uint8",
        "internalType": "enum IHistorialReputacion.Evento"
      },
      {
        "name": "monto",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "EventoRegistrado",
    "inputs": [
      {
        "name": "actor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "origen",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "evento",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum IHistorialReputacion.Evento"
      },
      {
        "name": "monto",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "FactoryYaConfigurada",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "SoloSistema",
    "inputs": []
  }
] as const;

export const reenviadorGasAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      {
        "name": "fields",
        "type": "bytes1",
        "internalType": "bytes1"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "version",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "extensions",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      {
        "name": "request",
        "type": "tuple",
        "internalType": "struct ERC2771Forwarder.ForwardRequestData",
        "components": [
          {
            "name": "from",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "to",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "value",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "gas",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint48",
            "internalType": "uint48"
          },
          {
            "name": "data",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "signature",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "executeBatch",
    "inputs": [
      {
        "name": "requests",
        "type": "tuple[]",
        "internalType": "struct ERC2771Forwarder.ForwardRequestData[]",
        "components": [
          {
            "name": "from",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "to",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "value",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "gas",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint48",
            "internalType": "uint48"
          },
          {
            "name": "data",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "signature",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "refundReceiver",
        "type": "address",
        "internalType": "address payable"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "nonces",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "verify",
    "inputs": [
      {
        "name": "request",
        "type": "tuple",
        "internalType": "struct ERC2771Forwarder.ForwardRequestData",
        "components": [
          {
            "name": "from",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "to",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "value",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "gas",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint48",
            "internalType": "uint48"
          },
          {
            "name": "data",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "signature",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ExecutedForwardRequest",
    "inputs": [
      {
        "name": "signer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "nonce",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "success",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ERC2771ForwarderExpiredRequest",
    "inputs": [
      {
        "name": "deadline",
        "type": "uint48",
        "internalType": "uint48"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC2771ForwarderInvalidSigner",
    "inputs": [
      {
        "name": "signer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC2771ForwarderMismatchedValue",
    "inputs": [
      {
        "name": "requestedValue",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "msgValue",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC2771UntrustfulTarget",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "forwarder",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "FailedCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientBalance",
    "inputs": [
      {
        "name": "balance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidAccountNonce",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "currentNonce",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidShortString",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "str",
        "type": "string",
        "internalType": "string"
      }
    ]
  }
] as const;

export const nombresDonantesAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "factory_",
        "type": "address",
        "internalType": "contract ICampanaFactoryNombres"
      },
      {
        "name": "reenviador",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "owner_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_BYTES_NOMBRE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "factory",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ICampanaFactoryNombres"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isTrustedForwarder",
    "inputs": [
      {
        "name": "forwarder",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "moderar",
    "inputs": [
      {
        "name": "campana",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "donante",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "mostrarNombre",
    "inputs": [
      {
        "name": "campana",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "nombre",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "nombrePublico",
    "inputs": [
      {
        "name": "campana",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "donante",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nombres",
    "inputs": [
      {
        "name": "campana",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "donantes",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [
      {
        "name": "lista",
        "type": "string[]",
        "internalType": "string[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ocultarNombre",
    "inputs": [
      {
        "name": "campana",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "trustedForwarder",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "NombreOcultado",
    "inputs": [
      {
        "name": "campana",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "donante",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "porModeracion",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NombrePublico",
    "inputs": [
      {
        "name": "campana",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "donante",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "nombre",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "CampanaNoOficial",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoEsDonante",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NombreInvalido",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  }
] as const;

