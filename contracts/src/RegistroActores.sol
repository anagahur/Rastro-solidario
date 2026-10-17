// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControlEnumerable } from
    "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

/// @title RegistroActores
/// @notice Asigna los roles del sistema: fundación, verificador y proveedor.
///         Solo los proveedores registrados pueden recibir pagos de una campaña.
/// @dev El administrador (DEFAULT_ADMIN_ROLE) representa a la entidad que habilita
///      actores (en la demo, quien despliega). Se usa la versión "Enumerable" para
///      que el frontend pueda listar proveedores y verificadores sin leer eventos
///      (el RPC público de Monad limita eth_getLogs a 100 bloques).
contract RegistroActores is AccessControlEnumerable {
    bytes32 public constant FUNDACION_ROLE = keccak256("FUNDACION_ROLE");
    bytes32 public constant VERIFICADOR_ROLE = keccak256("VERIFICADOR_ROLE");
    bytes32 public constant PROVEEDOR_ROLE = keccak256("PROVEEDOR_ROLE");
    /// @notice Empresa aliada que puede comprometer "matching" (p. ej. duplicar cada donación).
    bytes32 public constant EMPRESA_ROLE = keccak256("EMPRESA_ROLE");

    /// @notice Nombre público de cada actor (p. ej. "Supermercado La Economía", "Defensa Civil").
    mapping(address => string) public nombre;

    event ActorRegistrado(bytes32 indexed rol, address indexed cuenta, string nombre);
    event ActorRevocado(bytes32 indexed rol, address indexed cuenta);

    error RolInvalido(bytes32 rol);
    error CuentaInvalida();
    error NombreVacio();

    constructor(address admin) {
        if (admin == address(0)) revert CuentaInvalida();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Registra (o renombra) un actor con uno de los tres roles del sistema.
    function registrarActor(bytes32 rol, address cuenta, string calldata nombreActor)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _validarRol(rol);
        if (cuenta == address(0)) revert CuentaInvalida();
        if (bytes(nombreActor).length == 0) revert NombreVacio();
        nombre[cuenta] = nombreActor;
        _grantRole(rol, cuenta);
        emit ActorRegistrado(rol, cuenta, nombreActor);
    }

    /// @notice Quita un rol. Un proveedor revocado ya no puede cobrar etapas pendientes.
    function revocarActor(bytes32 rol, address cuenta) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _validarRol(rol);
        _revokeRole(rol, cuenta);
        emit ActorRevocado(rol, cuenta);
    }

    function esFundacion(address cuenta) external view returns (bool) {
        return hasRole(FUNDACION_ROLE, cuenta);
    }

    function esVerificador(address cuenta) external view returns (bool) {
        return hasRole(VERIFICADOR_ROLE, cuenta);
    }

    function esProveedor(address cuenta) external view returns (bool) {
        return hasRole(PROVEEDOR_ROLE, cuenta);
    }

    function esEmpresa(address cuenta) external view returns (bool) {
        return hasRole(EMPRESA_ROLE, cuenta);
    }

    /// @notice Lista todos los miembros de un rol con sus nombres (para el frontend).
    function actores(bytes32 rol)
        external
        view
        returns (address[] memory cuentas, string[] memory nombres)
    {
        uint256 n = getRoleMemberCount(rol);
        cuentas = new address[](n);
        nombres = new string[](n);
        for (uint256 i = 0; i < n; i++) {
            address c = getRoleMember(rol, i);
            cuentas[i] = c;
            nombres[i] = nombre[c];
        }
    }

    function _validarRol(bytes32 rol) private pure {
        if (
            rol != FUNDACION_ROLE && rol != VERIFICADOR_ROLE && rol != PROVEEDOR_ROLE
                && rol != EMPRESA_ROLE
        ) {
            revert RolInvalido(rol);
        }
    }
}
