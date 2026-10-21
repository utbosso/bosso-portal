import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessRoleScope } from '../src/lib/role-scope'

// These checks exercise boundaries used when selecting audiences for member content.
test('members cannot access content reserved for leadership', () => {
  assert.equal(canAccessRoleScope('general_member', 'board_member', 'minimum_role'), false)
  assert.equal(canAccessRoleScope('analyst', 'project_manager', 'minimum_role'), false)
  assert.equal(canAccessRoleScope(null, 'general_member', 'minimum_role'), false)
})

test('exact-role audiences stay distinct from minimum-role audiences', () => {
  assert.equal(canAccessRoleScope('project_manager', 'analyst', 'exact_role'), false)
  assert.equal(canAccessRoleScope('project_manager', 'analyst', 'minimum_role'), true)
  assert.equal(canAccessRoleScope('analyst', 'analyst', 'exact_role'), true)
})

test('administrators retain access to restricted scopes', () => {
  assert.equal(canAccessRoleScope('admin', 'board_member', 'exact_role'), true)
})
