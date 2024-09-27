const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                 status: 403,
                 message: 'Access denied'
            });
        }
        next();
    };
};

module.exports = checkRole;
