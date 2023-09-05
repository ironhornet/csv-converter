const DOWNLOAD_BTN = document.getElementById('downloadButton');
const BTN_TEXT = document.getElementById('btnText')
const LOADER = document.getElementById('loader');

const EXCHANGE_BASE_URL = 'https://api.exchangerate.host/';
const BASE_URL = 'https://api-staging.entriwise.com/mock/';
const ORDERS_URL = `${BASE_URL}test-task-orders`;
const ITEMS_URL = `${BASE_URL}test-task-items`;
const EXCHANGE_URL = `${EXCHANGE_BASE_URL}latest?&base=USD`;

const fetcher = async (url, options = {}) => {
  let response;
  response = await fetch(url, options);

  return await response.json();
};

const fetchData = async (url) => {
  try {
    const data = await fetcher(url);
    return data;
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error);
    throw error;
  }
};

const getCurrencyRate = () => fetchData(EXCHANGE_URL);
const getItems = () => fetchData(ITEMS_URL);
const getOrders = () => fetchData(ORDERS_URL);

const currencyToUsd = (amount, currency, currRate) => {
  if (!currRate[currency]) return null;
  return amount * (+currRate[currency]).toFixed(2);
}

const dateFormatConverter = (inputDate) => {
  if (!inputDate) return null

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateParts = inputDate.split("-");
  const month = months[parseInt(dateParts[1], 10) - 1];
  const day = parseInt(dateParts[2], 10);

  return `${month} ${day}`;
}


const createObjectWithKeys = (array, key) => (
  array.reduce((acc, curr) => {

    acc[curr[key]] = curr;
    return acc;
  }, {})
)

const convertCurrencyAndDate = (amount, currency, currRateToUsd, inputDate) => {
  const amountInUSD = currencyToUsd(amount, currency, currRateToUsd);
  const convertedDate = dateFormatConverter(inputDate)

  return {
    amountInUSD,
    newDate: convertedDate
  }
}

const mergeArrayOfObjects = ({ primaryArray, secondaryArray, key, currRateToUsd }) => {
  const objectWithKeys = createObjectWithKeys(secondaryArray, key);

  return primaryArray.reduce((acc, item) => {
    if (!objectWithKeys[item[key]]) return acc;

    const { amount, currency } = objectWithKeys[item[key]];
    const currAndDate = convertCurrencyAndDate(amount, currency, currRateToUsd, item.date)

    const mergedItem = {
      ...item,
      ...objectWithKeys[item[key]],
      ...currAndDate
    };

    return [...acc, mergedItem];
  }, []);
};

const fetchAndMergeData = async () => {
  const [itemsData, ordersData, currencyRateData] = await Promise.all([
    getItems(),
    getOrders(),
    getCurrencyRate()
  ]);

  const mergedData = mergeArrayOfObjects({
    primaryArray: ordersData.orders,
    secondaryArray: itemsData.items,
    key: 'itemId',
    currRateToUsd: currencyRateData.rates
  });

  return mergedData
}

const convertToCsv = (orderArray) => {
  if (!Array.isArray(orderArray) || orderArray.some(row => typeof row !== 'object')) {
    throw new Error('The input must be an array of objects.');
  }

  const headers = ['Item Name', 'Order ID', 'Order Date', 'Amount'];
  const csvData = orderArray.map(order =>
    `${order.itemName},${order.orderId},${order.newDate},${order.amountInUSD}`
  );

  return [headers.join(','), ...csvData].join('\n');
}

const saveFileTo = (filename, data) => {
  const blob = new Blob([data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

const toggleBtnText = (isLoading) => BTN_TEXT.textContent = isLoading ? 'Loading...' : 'Download';
const toggleBtnState = (isLoading) => DOWNLOAD_BTN.disabled = isLoading;
const toggleBtnLoader = (isLoading) => LOADER.style.display = isLoading ? 'inline-block' : 'none';

const changeButtonUiForLoading = (isLoading) => {
  toggleBtnText(isLoading);
  toggleBtnState(isLoading);
  toggleBtnLoader(isLoading);
};

const downloadClickHandler = async () => {
  try {
    changeButtonUiForLoading(true);
    const mergedData = await fetchAndMergeData();
    const csvContent = convertToCsv(mergedData);
    saveFileTo('orders.csv', csvContent);
  } catch (error) {
    console.error('Something went wrong while henereting CSV-file:', error);
  } finally {
    changeButtonUiForLoading(false);
  }
};

DOWNLOAD_BTN.addEventListener('click', downloadClickHandler)