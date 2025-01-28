import crypto from 'crypto';

export const generateConfirmationToken = () => {
    return crypto.randomBytes(20).toString('hex');
};
