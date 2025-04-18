const createId = (length) => {
  let res = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  for (let i = 0; i < length; i++) {
    res += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }

  return res;
}

module.exports = createId;