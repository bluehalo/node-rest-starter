import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';

const router = Router();

router.route('/test').get((req, res) => {
	res.status(StatusCodes.OK).json({ message: 'hello world' });
});

export = router;
