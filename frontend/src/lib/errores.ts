import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

export const MENSAJES: Record<string, string> = {
  SoloEmpresa: "Solo una empresa aliada registrada puede comprometer matching.",
  ConteoRequerido: "Indica cuántas unidades contaste en el sitio: la factura declaró unidades y el contrato las compara.",
  UnidadesRequeridas: "Indica cuántas unidades dice la factura: con eso se revisa el precio por unidad.",
  SinCenso: "Primero un verificador debe registrar el censo de familias damnificadas.",
  CensoLleno: "El censo llegó al máximo de familias.",
  BeneficiarioInvalido: "Esa cuenta no puede ser beneficiaria (ya está, o es fundación, verificador, empresa o proveedor).",
  NoEsBeneficiario: "Esta tarjeta no pertenece al censo de la campaña.",
  YaConfirmo: "Esta familia ya confirmó la entrega de esta etapa.",
  NoEsDonante: "Solo quien donó a esta campaña puede elegir cómo aparece en ella.",
  NombreInvalido: "El nombre debe tener entre 1 y 60 letras, en una sola línea.",
  CampanaNoOficial: "Esa no es una campaña oficial de Rastro Solidario.",
  MatchingInvalido: "La proporción o el tope del matching no son válidos.",
  MatchingDuplicado: "Esta empresa ya tiene un matching en la campaña.",
  DemasiadosMatchings: "La campaña ya tiene el máximo de empresas aliadas (3).",
  ERC2771ForwarderExpiredRequest: "La firma expiró. Intenta de nuevo.",
  ERC2771ForwarderInvalidSigner: "La firma no es válida.",
  SoloFundacion: "Solo la fundación de esta campaña puede hacer esto.",
  SoloVerificador: "Solo un verificador asignado (y activo) a esta campaña puede votar.",
  EstadoInvalido: "La campaña no está en el estado adecuado para esta acción.",
  EtapaInvalida: "Esa no es la etapa actual de la campaña.",
  EstadoEtapaInvalido: "La etapa no está en el estado adecuado para esta acción.",
  MontoCero: "El monto debe ser mayor que cero.",
  RecaudoVencido: "El plazo de recaudo ya terminó.",
  SinFondos: "La campaña no ha recibido donaciones.",
  NoAutorizado: "Solo la fundación puede cerrar el recaudo antes de que venza el plazo.",
  PlazoVencido: "El plazo de la etapa venció. Se puede activar el reembolso.",
  PlazoNoVencido: "El plazo de la etapa todavía no ha vencido.",
  ProveedorNoAutorizado: "El proveedor no está registrado o fue dado de baja.",
  ConflictoDeInteres: "Conflicto de interés: la fundación, un verificador, una empresa aliada o una familia beneficiaria no pueden ser quien cobra.",
  YaVoto: "Ya votaste en esta etapa.",
  HashVacio: "Falta la evidencia (hash del archivo).",
  PermisoInvalido: "La firma del permiso no es válida o expiró.",
  NadaQueReclamar: "No tienes reembolso disponible en esta campaña.",
  ConfigInvalida: "La configuración de la campaña no es válida",
  SoloCampanas: "Solo las campañas oficiales pueden emitir recibos.",
  RolInvalido: "Rol inválido.",
  CuentaInvalida: "Dirección inválida.",
  NombreVacio: "El nombre no puede estar vacío.",
  AccessControlUnauthorizedAccount: "Tu wallet no tiene permiso para esta acción.",
  ERC20InsufficientBalance: "No tienes suficientes MockCOP. Usa el faucet.",
  ERC20InsufficientAllowance: "Falta autorizar (approve) los MockCOP para la campaña.",
};

export function mensajeError(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "Cancelaste la operación en la wallet.";
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const nombre = revert?.data?.errorName;
    if (nombre) {
      const base = MENSAJES[nombre] ?? nombre;
      const extra = nombre === "ConfigInvalida" && revert?.data?.args?.[0] ? `: ${String(revert.data.args[0])}` : "";
      return base + extra;
    }
    if (/insufficient funds/i.test(e.message)) return "No tienes suficiente gas (MON) en la wallet. Pide en https://faucet.monad.xyz";
    return e.shortMessage;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}
