const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/coursesController');

router.get('/courses', coursesController.getCourses);
router.post('/courses', coursesController.createCourse);
router.put('/courses/:courseId', coursesController.updateCourse);
router.delete('/courses/:courseId', coursesController.deleteCourse);

module.exports = router;
