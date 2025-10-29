# AI Coding Methodology

This guide outlines the recommended practices and methodology using AI coding assistants.

## Overview

When working with AI assistants to extend or modify the repo, following these guidelines ensures consistency, reliability, and maintainability of the codebase.

## Core Principles

### 1. Server Lifecycle Management

**The user should be the only one starting/restarting servers, not AI agents.**

- AI assistants should **never** automatically start or restart development servers
- If a server restart is needed, the AI should **request permission** from the user first
- This prevents multiple sessions, port conflicts, and unexpected service interruptions

```bash
# ❌ AI should NOT do this automatically
pnpm dev:api

# ✅ AI should ask: "Would you like me to restart the API server to apply these changes?"
```

**Why this matters:**

- Prevents port conflicts and hanging processes
- Gives user control over their development environment
- Avoids unexpected service interruptions during active development

### 2. UI Component Strategy

**Always favor existing components over external dependencies or creating from scratch.**

The priority order should be:

1. **Use existing components** from the current codebase
2. **Explain alternatives** and ask user before importing external dependencies
3. **Create from scratch** only as a last resort with user approval

```typescript
// ✅ Preferred: Use existing components
import { DataTable } from '@/components/data-table';

// ⚠️ Requires explanation: External dependency
// AI should explain why this is needed and ask for approval
import { SomeExternalComponent } from 'external-library';
```

**Implementation approach:**

- First, search the codebase for similar existing components
- Only suggest external dependencies when existing options are insufficient
- Always explain the reasoning and provide alternatives

### 3. API Modification Protocol

**Any change that modifies the API should be explained prior to being implemented.**

Before making API changes, the AI should:

1. **Explain the change** and its impact
2. **Show the affected endpoints**
3. **Describe breaking changes** if any
4. **Wait for user approval** before proceeding

**Change categories to highlight:**

- New endpoints
- Modified request/response schemas
- Breaking changes to existing APIs
- Database schema modifications

### 4. API Standards Compliance

**When dealing with listings, use cursor-based pagination.**

All listing endpoints should follow the established cursor pagination pattern:

```typescript
// ✅ Standard pagination response format
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    total?: number; // optional, include when cheap/available
  };
}

// ✅ Standard query parameters
interface PaginationQuery {
  cursor?: string; // opaque offset/ID; null or omitted for first page
  limit?: number; // Default: 50, Max: 200 (unless a feature needs different bounds)
}
```

**Implementation checklist:**

- Use consistent parameter names (`cursor`, `limit`)
- Return standardized `pagination` with `nextCursor`, `hasMore`, and `total` (optional)
- Reuse `paginationSchema` in DTOs instead of redefining fields
- Keep `total` optional; include it when it’s inexpensive to compute


### 5. Planning and Approval Process

**Don't execute anything before showing and getting user agreement on the plan.**

The workflow should always be:

1. **Analyze the problem** - Understand what needs to be solved
2. **Understand the system** - Explore existing code and patterns
3. **Design the solution** - Plan the implementation approach
4. **Get user approval** - Present the plan and wait for confirmation
5. **Implement the solution** - Execute the approved plan

```
# ✅ Correct approach:
# "I've analyzed the requirement and here's my plan:
# 1. Add new field to User model
# 2. Update API endpoints (3 files affected)
# 3. Modify frontend forms
#
# Should I proceed with this implementation?"

# ❌ Wrong approach:
# Immediately starting to implement without showing the plan
```

### 6. System Consistency

**Always ensure database/app/api consistency when making changes.**

When making any change, verify:

- **Database schema** aligns with API models
- **API responses** match frontend expectations
- **Type definitions** are consistent across layers
- **Validation rules** are applied consistently

```typescript
// ✅ Ensure consistency across layers:
// 1. Database: Prisma schema
// 2. API: DTOs and validation
// 3. Frontend: TypeScript interfaces
```

### 7. No Test Generation

The coding agent must not create or modify tests for the changes it makes. Test authoring and maintenance are handled by the human team. Unless humans ask specifically to create/change tests

### 8. KISS Principle

**Solutions should be as elegant and simple as possible: Keep It Simple, Stupid.**

- Avoid over-engineering solutions
- Choose the simplest approach that meets requirements
- Reduce complexity wherever possible
- Prefer readable code over clever code

### 9. Code Reuse and DRY

**Always reuse code and follow the DRY (Don't Repeat Yourself) principle.**

- Search for existing implementations before creating new ones
- Extract common functionality into shared utilities
- Reuse existing components and services
- Avoid duplicating logic across different parts of the application

### 10. SOLID Conventions

**Follow SOLID conventions of existing repositories and challenge when appropriate.**

- **S**ingle Responsibility: Each class/function has one reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Derived classes must be substitutable for base classes
- **I**nterface Segregation: Many specific interfaces are better than one general
- **D**ependency Inversion: Depend on abstractions, not concretions

Challenge existing code when it violates these principles, but explain why.

## Best Practices

### Code Quality

- Follow existing code patterns and conventions
- Maintain consistent naming conventions
- Add appropriate TypeScript types
- Include proper error handling