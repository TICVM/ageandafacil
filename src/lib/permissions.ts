
import { UserRole } from './types';

/**
 * Define todas as permissões granulares do sistema.
 */
export interface AppPermissions {
  canManageUsers: boolean;
  canConfigureSlots: boolean;
  canManageLocations: boolean;
  canManageClasses: boolean;
  canViewReports: boolean;
  canViewAllAppointments: boolean;
  canCreateBookings: boolean;
}

/**
 * Mapa de permissões por cargo.
 * O Administrador (ADMIN) tem acesso total.
 */
export const ROLE_PERMISSIONS: Record<UserRole, AppPermissions> = {
  ADMIN: {
    canManageUsers: true,
    canConfigureSlots: true,
    canManageLocations: true,
    canManageClasses: true,
    canViewReports: true,
    canViewAllAppointments: true,
    canCreateBookings: true,
  },
  COORDINATOR: {
    canManageUsers: true,
    canConfigureSlots: false,
    canManageLocations: false,
    canManageClasses: false,
    canViewReports: false,
    canViewAllAppointments: true, // Filtrado por segmento via código nas páginas
    canCreateBookings: true,
  },
  TEACHER: {
    canManageUsers: false,
    canConfigureSlots: false,
    canManageLocations: false,
    canManageClasses: false,
    canViewReports: false,
    canViewAllAppointments: false, // Vê apenas os seus próprios
    canCreateBookings: true,
  },
};

/**
 * Função principal para obter as permissões de um usuário.
 * @param role O cargo do usuário (ADMIN, COORDINATOR, TEACHER)
 * @returns Um objeto AppPermissions com booleanos para cada funcionalidade.
 */
export function getPermissionsByRole(role: UserRole): AppPermissions {
  if (role === 'ADMIN') {
    return ROLE_PERMISSIONS.ADMIN;
  }
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.TEACHER;
}
