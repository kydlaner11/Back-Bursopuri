/**
 * The helper functions for the model that use knex to store and retrieve data from the database using the provided 'knex' instance.
 */


module.exports = ({
  knex = {},
  name = 'name',
  tableName = 'tableName',
  selectableProps = [],
  timeout = 1000,
}) => {
  const create =  (props) => {
    delete props.id;
    return knex.insert(props).into(tableName).timeout(timeout);
  }

  const find = (filters) => {
    return knex.select(selectableProps).from(tableName).where(filters).timeout(timeout);
  }

  const findOne = (filters) => find(filters).then((results) => {
    if (!Array.isArray(results)) return results;
    return results[0];
  });

  return {
    create,
    find,
    findOne,
  }
}