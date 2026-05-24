const express = require('express');
const router = express.Router();
const {
  getGradingPeriods,
  createGradingPeriod,
  deleteGradingPeriod,
  getThresholdOverrides,
  saveThresholdOverrides,
  createCustomGradingSystem,
  getTwoFactorStatus,
  enableTwoFactor,
  disableTwoFactor,
  getLmsAccounts,
  addLmsAccount,
  removeLmsAccount,
  exportDataCsv,
  exportDataPdf,
  sendFeedback,
} = require('../controllers/settingsController');

router.get('/grading-periods', getGradingPeriods);
router.post('/grading-periods', createGradingPeriod);
router.delete('/grading-periods/:id', deleteGradingPeriod);

router.get('/threshold-overrides', getThresholdOverrides);
router.put('/threshold-overrides', saveThresholdOverrides);

router.post('/grading-systems/custom', createCustomGradingSystem);

router.get('/two-factor/status', getTwoFactorStatus);
router.post('/two-factor/enable', enableTwoFactor);
router.post('/two-factor/disable', disableTwoFactor);

router.get('/lms-accounts', getLmsAccounts);
router.post('/lms-accounts', addLmsAccount);
router.delete('/lms-accounts/:id', removeLmsAccount);

router.get('/export/csv', exportDataCsv);
router.get('/export/pdf', exportDataPdf);

router.post('/feedback', sendFeedback);

module.exports = router;
