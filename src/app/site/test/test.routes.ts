import { Router } from 'express';

const router = Router();

router.route('/test').get((req, res) => {
	res.status(200).json({ message: 'hello world' });
});

export = router;
