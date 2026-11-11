import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
	res.json({
		title: 'About Us',
		description: 'Information about the RMS application and the team behind it.',
	});
});

export const aboutRoutes = router;
