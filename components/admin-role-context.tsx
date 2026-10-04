"use client";

import { createContext, useContext } from "react";
import type { AdminRole } from "@/lib/admin-auth";

const AdminRoleContext = createContext<AdminRole>("owner");
export function AdminRoleProvider({ role, children }: { role: AdminRole; children: React.ReactNode }) { return <AdminRoleContext.Provider value={role}>{children}</AdminRoleContext.Provider>; }
export function useAdminRole() { return useContext(AdminRoleContext); }
