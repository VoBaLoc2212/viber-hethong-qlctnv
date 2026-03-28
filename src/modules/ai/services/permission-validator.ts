/**
 * Permission Validator Service
 * Validates user permissions and builds filters for data access
 */

import type { UserRole } from "@prisma/client";

import { PermissionFilter, UserContext, UserFilters } from "../types";

export class PermissionValidator {
  buildUserContext(
    userId: string,
    role: UserRole,
    departmentIds: string[] = []
  ): UserContext {
    const filters = this.buildPermissionFilters(role, departmentIds);

    return {
      user_id: userId,
      role,
      department_ids: departmentIds,
      filters,
    };
  }

  private buildPermissionFilters(role: UserRole, departmentIds: string[]): UserFilters {
    const baseFilters: UserFilters = {
      budget_filter: { extra: {} },
      transaction_filter: { extra: {} },
      read_only_mode: true,
    };

    if (role === "EMPLOYEE") {
      baseFilters.budget_filter.departments = departmentIds;
      baseFilters.transaction_filter.departments = departmentIds;
      baseFilters.transaction_filter.statuses = ["EXECUTED", "APPROVED"];
    } else if (role === "MANAGER") {
      baseFilters.budget_filter.departments = departmentIds;
      baseFilters.transaction_filter.departments = departmentIds;
      baseFilters.transaction_filter.statuses = ["EXECUTED", "APPROVED", "PENDING"];
    } else if (role === "ACCOUNTANT") {
      baseFilters.transaction_filter.statuses = ["EXECUTED", "PENDING", "APPROVED"];
    } else if (role === "FINANCE_ADMIN") {
      // Full access
      baseFilters.budget_filter = { extra: {} };
      baseFilters.transaction_filter = { extra: {} };
    } else if (role === "AUDITOR") {
      // Full read-only access
      baseFilters.budget_filter = { extra: {} };
      baseFilters.transaction_filter = { extra: {} };
    }

    return baseFilters;
  }

  canAccessData(
    userContext: UserContext,
    dataType: string,
    options?: Record<string, any>
  ): boolean {
    if (!userContext.filters.read_only_mode) {
      return false;
    }

    if (!options) {
      options = {};
    }

    const role = userContext.role;
    const departmentIds = userContext.department_ids;

    if (dataType === "budget") {
      if (
        options.department_id &&
        !["FINANCE_ADMIN", "AUDITOR"].includes(role) &&
        !departmentIds.includes(options.department_id)
      ) {
        return false;
      }
      return true;
    }

    if (dataType === "transaction") {
      if (
        options.department_id &&
        role === "EMPLOYEE" &&
        !departmentIds.includes(options.department_id)
      ) {
        return false;
      }
      return true;
    }

    if (dataType === "ledger") {
      if (!["FINANCE_ADMIN", "AUDITOR"].includes(role)) {
        return false;
      }
      return true;
    }

    if (dataType === "report") {
      if (
        options.department_id &&
        role === "MANAGER" &&
        !departmentIds.includes(options.department_id)
      ) {
        return false;
      }
      return true;
    }

    return false;
  }

  mergeFilters(
    requestedFilter: Record<string, any>,
    userFilter: PermissionFilter
  ): Record<string, any> {
    const merged = { ...requestedFilter };

    if (userFilter.departments && userFilter.departments.length > 0) {
      if ("departments" in merged) {
        merged.departments = merged.departments.filter((d: string) =>
          userFilter.departments?.includes(d)
        );
      } else {
        merged.departments = userFilter.departments;
      }
    }

    if (userFilter.categories && userFilter.categories.length > 0) {
      if ("categories" in merged) {
        merged.categories = merged.categories.filter((c: string) =>
          userFilter.categories?.includes(c)
        );
      } else {
        merged.categories = userFilter.categories;
      }
    }

    if (userFilter.statuses && userFilter.statuses.length > 0) {
      if ("statuses" in merged) {
        merged.statuses = merged.statuses.filter((s: string) =>
          userFilter.statuses?.includes(s)
        );
      } else {
        merged.statuses = userFilter.statuses;
      }
    }

    return merged;
  }
}
