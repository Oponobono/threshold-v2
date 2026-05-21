const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/assessmentCategoriesController');

// Mounted at /api
router.get('/subjects/:subjectId/categories', categoriesController.getCategoriesBySubject);
router.post('/subjects/:subjectId/categories', categoriesController.createCategory);

router.put('/categories/:id', categoriesController.updateCategory);
router.delete('/categories/:id', categoriesController.deleteCategory);

module.exports = router;
