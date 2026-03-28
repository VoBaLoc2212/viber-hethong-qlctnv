import { PermissionFilter, UserContext } from "@/modules/ai/types";
import { UserRole } from "@prisma/client";

export class PermissionValidator {
  buildUserContext(
    userId: string,
    role: UserRole,
    departmentIds: string[] = []
  ): UserContext {
    const filters = this.buildPermissionFilters(role, departmentIds);

    return {
      user_id: userId,
      userId: userId,

      role,
      department_ids: departmentIds,

      filters,
    };
  }

  private emptyFilter(): PermissionFilter {
    return {
      departments: [],
      categories: [],
      statuses: [],
      extra: {},
    };
  }

  private buildPermissionFilters(
    role: UserRole,
    departmentIds: string[]
  ): UserContext["filters"] {
    const baseFilters: UserContext["filters"] = {
      budget_filter: this.emptyFilter(),
      transaction_filter: this.emptyFilter(),
      read_only_mode: true,

      // alias
      budgetFilter: this.emptyFilter(),
      transactionFilter: this.emptyFilter(),
      readOnlyMode: true,
    };

    switch (role) {
      case "EMPLOYEE":
        baseFilters.budgetFilter = {
          ...this.emptyFilter(),
          departments: departmentIds,
        };

        baseFilters.transactionFilter = {
          ...this.emptyFilter(),
          departments: departmentIds,
          statuses: ["EXECUTED", "APPROVED"],
        };
        break;

      case "MANAGER":
        baseFilters.budgetFilter = {
          ...this.emptyFilter(),
          departments: departmentIds,
        };

        baseFilters.transactionFilter = {
          ...this.emptyFilter(),
          departments: departmentIds,
          statuses: ["EXECUTED", "APPROVED", "PENDING"],
        };
        break;

      case "ACCOUNTANT":
        baseFilters.transactionFilter = {
          ...this.emptyFilter(),
          statuses: ["EXECUTED", "PENDING", "APPROVED"],
        };
        break;

      case "FINANCE_ADMIN":
      case "AUDITOR":
        // full access → keep emptyFilter
        break;
    }

    return baseFilters;
  }

  canAccessData(
    userContext: UserContext,
    dataType: "budget" | "transaction" | "ledger" | "report",
    options?: { departmentId?: string }
  ): boolean {
    if (!userContext.filters.readOnlyMode) return false;

    const role = userContext.role;
    const departments = userContext.department_ids;

    switch (dataType) {
      case "budget":
        if (
          options?.departmentId &&
          !["FINANCE_ADMIN", "AUDITOR"].includes(role) &&
          !departments.includes(options.departmentId)
        ) {
          return false;
        }
        return true;

      case "transaction":
        if (
          options?.departmentId &&
          role === "EMPLOYEE" &&
          !departments.includes(options.departmentId)
        ) {
          return false;
        }
        return true;

      case "ledger":
        return ["FINANCE_ADMIN", "AUDITOR"].includes(role);

      case "report":
        if (
          options?.departmentId &&
          role === "MANAGER" &&
          !departments.includes(options.departmentId)
        ) {
          return false;
        }
        return true;

      default:
        return false;
    }
  }

  mergeFilters(
    requested: Record<string, any>,
    userFilter: PermissionFilter
  ): Record<string, any> {
    const merged = { ...requested };

    if (userFilter.departments?.length) {
      merged.departments = merged.departments
        ? merged.departments.filter((d: string) =>
            userFilter.departments!.includes(d)
          )
        : userFilter.departments;
    }

    if (userFilter.categories?.length) {
      merged.categories = merged.categories
        ? merged.categories.filter((c: string) =>
            userFilter.categories!.includes(c)
          )
        : userFilter.categories;
    }

    if (userFilter.statuses?.length) {
      merged.statuses = merged.statuses
        ? merged.statuses.filter((s: string) =>
            userFilter.statuses!.includes(s)
          )
        : userFilter.statuses;
    }

    return merged;
  }

  isAccessBlocked(userContext: UserContext): boolean {
    if (!userContext.filters.readOnlyMode) return true;

    if (
      userContext.role === "EMPLOYEE" &&
      userContext.department_ids.length === 0
    ) {
      return true;
    }

    return false;
  }

  getAccessMask(
    role: UserRole,
    totalDepartments: number,
    userDepartmentCount: number
  ): number {
    switch (role) {
      case "FINANCE_ADMIN":
      case "AUDITOR":
      case "ACCOUNTANT":
        return 1;

      case "MANAGER":
      case "EMPLOYEE":
        return userDepartmentCount / Math.max(totalDepartments, 1);

      default:
        return 0;
    }
  }
}

// singleton
let validator: PermissionValidator | null = null;

export function getPermissionValidator() {
  if (!validator) validator = new PermissionValidator();
  return validator;
}