const createModelHelper = require('../helpers/modelHelper');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_TTL } = require('../../config');

const name = 'User';
const tableName = 'users';

const selectableProps = [
  'id', 
  'email', 
  'first_name', 
  'last_name', 
  'role',
  'created_at', 
];

const SALT_ROUNDS = 10;
const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

const beforeSave = async (user) => {
  if (!user.password) return Promise.resolve(user);
  return hashPassword(user.password)
    .then((hash) => ({ ...user, password: hash }))
    .catch((err) => `Error in hashing password ${err}`);
};

module.exports = ({ knex }) => {
  const userHelper = createModelHelper({
    knex,
    name,
    tableName,
    selectableProps,
  });

  const create = (props) => beforeSave(props).then((user) => userHelper.create(user));

  const verify = async (email, password) => {
    const user = await knex.select()
      .from(tableName)
      .where({ email });

    if (user.length > 0){
      const isMatch = await verifyPassword(password, user[0].password);
      if (isMatch) {
        delete user[0].password;
        const token = jwt.sign(user[0] , JWT_SECRET, { expiresIn: JWT_TTL });
        return { ...user[0], token };
      } else {
        return null;
      }
    }
    throw new Error('Password does not match');
  }


  return {
    name,
    ...userHelper,
    create,
    verify,
}};