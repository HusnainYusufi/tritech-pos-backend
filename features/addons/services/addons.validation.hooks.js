/**
 * 🛡️ PRODUCTION-GRADE VALIDATION HOOKS FOR ADD-ONS
 * 
 * Prevents data integrity issues by validating:
 * - Groups must have valid categories
 * - Items must have valid groups and categories
 * - Orphaned data is prevented at creation time
 */

'use strict';

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');

/**
 * Validate add-on group before creation/update
 */
async function validateAddOnGroup(conn, data, CategoryRepo) {
  if (!data.categoryId) {
    throw new AppError('categoryId is required for add-on group', 400);
  }

  const category = await CategoryRepo.getById(conn, data.categoryId);
  if (!category) {
    throw new AppError(`Category not found: ${data.categoryId}`, 404);
  }

  logger.info('[AddOnValidation] Group validation passed', {
    categoryId: data.categoryId,
    categoryName: category.name
  });

  return category;
}

/**
 * Validate add-on item before creation/update
 */
async function validateAddOnItem(conn, data, GroupRepo, CategoryRepo) {
  if (!data.groupId) {
    throw new AppError('groupId is required for add-on item', 400);
  }

  if (!data.categoryId) {
    throw new AppError('categoryId is required for add-on item', 400);
  }

  // Validate group exists
  const group = await GroupRepo.getById(conn, data.groupId);
  if (!group) {
    throw new AppError(`Add-on group not found: ${data.groupId}`, 404);
  }

  // Validate category exists
  const category = await CategoryRepo.getById(conn, data.categoryId);
  if (!category) {
    throw new AppError(`Category not found: ${data.categoryId}`, 404);
  }

  // Validate group and category match
  if (String(group.categoryId) !== String(data.categoryId)) {
    throw new AppError(
      `Category mismatch: Item categoryId (${data.categoryId}) must match group's categoryId (${group.categoryId})`,
      400
    );
  }

  logger.info('[AddOnValidation] Item validation passed', {
    groupId: data.groupId,
    groupName: group.name,
    categoryId: data.categoryId,
    categoryName: category.name
  });

  return { group, category };
}

/**
 * Validate before deleting add-on group
 */
async function validateGroupDeletion(conn, groupId, ItemRepo) {
  const hasItems = await ItemRepo.existsByGroup(conn, groupId);
  if (hasItems) {
    throw new AppError(
      'Cannot delete add-on group that has items. Delete items first or reassign them.',
      400
    );
  }

  logger.info('[AddOnValidation] Group deletion validation passed', {
    groupId
  });
}

module.exports = {
  validateAddOnGroup,
  validateAddOnItem,
  validateGroupDeletion
};

