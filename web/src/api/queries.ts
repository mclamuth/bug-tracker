import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { ApplicationDto, LookupsDto, UserDto } from './types'

export const queryKeys = {
  me: ['me'] as const,
  users: (role?: string) => ['users', role ?? 'all'] as const,
  applications: ['applications'] as const,
  lookups: ['lookups'] as const,
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => apiFetch<UserDto>('/api/v1/me') })
}

export function useUsers(role?: 'developer' | 'ica' | 'supervisor') {
  return useQuery({
    queryKey: queryKeys.users(role),
    queryFn: () => apiFetch<UserDto[]>(role ? `/api/v1/users?role=${role}` : '/api/v1/users'),
  })
}

export function useApplications() {
  return useQuery({
    queryKey: queryKeys.applications,
    queryFn: () => apiFetch<ApplicationDto[]>('/api/v1/applications'),
  })
}

export function useLookups() {
  return useQuery({
    queryKey: queryKeys.lookups,
    queryFn: () => apiFetch<LookupsDto>('/api/v1/lookups'),
    staleTime: 60 * 60 * 1000, // The workflow rarely changes.
  })
}
