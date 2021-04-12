'use strict';

const express = require('express');

const router = express.Router();

router.route('/test').get((req, res) => {
	res.status(200).json({ message: 'hello world' });
});

module.exports = router;
