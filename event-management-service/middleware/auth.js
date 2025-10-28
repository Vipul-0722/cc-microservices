// This middleware simulates the authorization step performed by the API Gateway.

exports.authenticate = (req, res, next) => {
    // 1. Check for the authenticated User ID header passed by the API Gateway
    const authenticatedUserId = req.headers['x-user-id'];

    if (!authenticatedUserId) {
        // This should theoretically not happen if the API Gateway is set up correctly
        return res.status(401).send({ message: "Authentication required (Missing X-User-ID header)." });
    }

    // 2. Attach the authenticated user ID to the request object for use in controllers
    req.user = { id: authenticatedUserId };
    console.log(req.user,"from middleware")
    next();
};

exports.authorizeUserAccess = (req, res, next) => {
    // This middleware verifies that the user is authorized to perform an action on *their own* account.
    
    // 1. Get the authenticated user ID from the previous middleware
    const authenticatedUserId = req.user.id;

    console.log(authenticatedUserId,"from middleware 2")
    
    // 2. Get the target user ID from the URL path
    const targetUserId = req.params.user_id;

    // 3. Compare the IDs
    if (authenticatedUserId !== targetUserId) {
        // If the authenticated user ID does not match the profile they are trying to access/modify, deny access.
        return res.status(403).send({ message: "Forbidden: You do not have permission to access this resource." });
    }

    // If IDs match, proceed
    next();
};