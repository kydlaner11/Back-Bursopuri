const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../database/connection');
const { JWT_SECRET, JWT_TTL } = require('../../config');

const SALT_ROUNDS = 10;

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

const create = async (props) => {
  if (props.password) {
    props.password = await hashPassword(props.password);
  }
  return prisma.user.create({ data: props });
};

const verify = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && (await verifyPassword(password, user.password))) {
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_TTL });
    delete user.password;
    return { ...user, token };
  }
  throw new Error('Invalid email or password');
};

module.exports = {
  create,
  verify,
};