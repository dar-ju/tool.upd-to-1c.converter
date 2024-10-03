const fileInput = document.getElementById('formFileLg');
const container = document.querySelector('.container');
const maxFileSize = 1000 * 1024;

// константы для идентфикации
const documentSeparator = 'Универсальный передаточный документ';
const totalSumm = 'Всего к оплате';
const numOfDoc = 'Счёт-фактура №';

// функция для вызова модалки
function showModal(newText) {
  document.getElementById('modalText').textContent = newText;
  new bootstrap.Modal(document.getElementById('modal')).show();
}

// записываем в localstorage значения по умолчанию
defaultColumns = JSON.stringify({
  code: 'Код товара/работ, услуг',
  quant: 'Коли-чество(объем)',
  summ: 'Стоимость товаров(работ, услуг), имущественных прав с налогом - всего'
});

// если localstorage пустое
if (!localStorage.getItem('komus')) {
  localStorage.setItem('komus', defaultColumns);
};

let localData = JSON.parse(localStorage.getItem('komus'));

// определяем поля
codeField = document.getElementById('code');
quantField = document.getElementById('quant');
summField = document.getElementById('summ');

// заполняем поля данными
function fieldsFill() {
  codeField.value = localData.code;
  quantField.value = localData.quant;
  summField.value = localData.summ;
};
fieldsFill();

// сброс на умолчания
document.getElementById('reset').addEventListener(('click'), () => {
  localStorage.setItem('komus', defaultColumns);
  localData = JSON.parse(localStorage.getItem('komus'));
  fieldsFill();
});

// изменяем localsorage из полей
const fields = ['code', 'quant', 'summ'];
fields.forEach(field => {
  document.getElementById(field).addEventListener('blur', (e) => {
    localData[field] = e.target.value;
    localStorage.setItem('komus', JSON.stringify(localData));
  });
});

// при загрузке файла
fileInput.addEventListener('change', function (event) {
  const file = event.target.files[0];

  // проверка на размер
  if (file.size > maxFileSize) {
    showModal('Размер файла не должен превышать 1 мег.')
    return;
  }

  // читаем файл
  const reader = new FileReader();
  reader.readAsArrayBuffer(file);

  // когда файл будет прочитан
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });

    // конвертируем первый лист в JSON
    let jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    // обрабатываем данные, удаляя лишние пробелы и переносы строк
    jsonData = jsonData.map(row => {
      const cleanedRow = {};
      for (const key in row) {
        if (typeof row[key] === 'string') {
          cleanedRow[key] = row[key].replace(/[\r\n]+/g, '').trim();
        } else cleanedRow[key] = row[key];
      }
      return cleanedRow;
    });

    // считаем количество документов
    const count = jsonData.filter(obj => {
      return Object.values(obj).some(value =>
        typeof value === 'string' && value.includes(documentSeparator)
      );
    }).length;

    // собираем индексы в кучу
    const indexesIfSf = [];
    for (let i = 0; i < jsonData.length; i++) {
      if (Object.values(jsonData[i]).some(value => typeof value === 'string' && value.includes(documentSeparator))) {
        indexesIfSf.push(i);
      };
    };

    // функция нахождения названия ключа по его значению во всем файле
    function findColumn(colName) {
      try {
        // убираем пробелы и переносы, чтобы пользователь с этим не возился
        const cleanedName = colName.replace(/\s+/g, '');
        const indexOfCode = jsonData.findIndex(obj => {
          return Object.values(obj).some(value => {
            // также убираем в исходном объекте
            const cleanedValue = value.replace(/\s+/g, '');
            return cleanedValue.includes(cleanedName);
          });
        });
        return Object.keys(jsonData[indexOfCode]).find(key =>
          jsonData[indexOfCode][key].replace(/\s+/g, '') === cleanedName
        );
      }
      catch (err) {
        console.error(err);
      };
    };

    // находим ключевые поля и выводим модалки, если проблемы
    let productQuantItem, productSummItem;
    const productCodeItem = findColumn(localData.code);
    if (productCodeItem == undefined) showModal('Загружен не файл с накладными. Иначе нужно проверить название колонки "Код товара" в документе и изменить ее в контрольном поле.');
    else {
      productQuantItem = findColumn(localData.quant);
      if (productQuantItem == undefined) showModal('Не определяется колонка с количеством. Нужно проверить название колонки "Количество" в документе и изменить ее в контрольном поле.');
      else {
        productSummItem = findColumn(localData.summ);
        if (productSummItem == undefined) showModal('Не определяется колонка с суммой номенклатуры. Нужно проверить название колонки "Стоимость товаров с налогом - всего" в документе и изменить ее в контрольном поле.');
      };
    };

    // получаем все суммы
    const allSummValues = [];
    for (let i = 0; i < jsonData.length; i++) {
      if (Object.values(jsonData[i]).some(value => typeof value === 'string' && value.includes(totalSumm))) {
        allSummValues.push(jsonData[i][productSummItem]);
      };
    };

    // формируем окончательный массив
    const slicedBySf = [];
    const finalData = [];
    const regular = new RegExp('^\\d+$');
    for (let i = 0; i < count; i++) {
      slicedBySf.push(jsonData.slice(indexesIfSf[i], indexesIfSf[i + 1]));
      finalData.push([]);
      for (let item in slicedBySf[i]) {
        if (regular.test(slicedBySf[i][item][productCodeItem])) finalData[i].push({
          code: slicedBySf[i][item][productCodeItem],
          quant: slicedBySf[i][item][productQuantItem],
          summ: slicedBySf[i][item][productSummItem]
        });
      };
    };


    // РИСУЕМ DOM накладных

    // создаем основные элементы
    if (document.getElementById('docContainer')) {
      document.getElementById('docContainer').remove();
    };
    const docDiv = document.createElement('div');
    docDiv.id = 'docContainer'
    Object.assign(docDiv.style, {
      display: 'flex',
      flexWrap: 'wrap',
      marginBottom: '30px',
      gap: '15px',
    });
    container.append(docDiv);

    // окна каждой накладной
    for (let i = 0; i < count; i++) {
      const docWrap = document.createElement('div');
      Object.assign(docWrap.style, {
        display: 'flex',
        width: '182px',
        flexDirection: 'column',
        padding: '10px',
        outline: '1px solid gray'
      });
      docDiv.append(docWrap);

      // заголовок с номером документа
      const docTitle = document.createElement('p');
      docTitle.style.fontSize = '12px';

      // находим заголовок СФ
      const findDocIndex = Object.values(jsonData[indexesIfSf[i]]).findIndex(item => item.includes(numOfDoc));
      const tempMass = Object.keys(jsonData[indexesIfSf[i]]);
      const docEl = tempMass[findDocIndex];

      if (jsonData[indexesIfSf[i]][docEl]) {
        docTitle.textContent = jsonData[indexesIfSf[i]][docEl].split(' ').slice(0, 3).join(' ');
      }
      docWrap.append(docTitle);

      // кнопка копирования
      const docCopyBtn = document.createElement('button');
      docCopyBtn.classList.add('btn', 'btn-primary', 'mb-2');
      docCopyBtn.type = 'button';
      docCopyBtn.textContent = 'Скопировать';
      docWrap.append(docCopyBtn);

      // копируем в буфер
      docCopyBtn.addEventListener('click', () => {
        let textMass = [];
        finalData[i].forEach(item => {
          textMass.push(`${item.code}\t\t\t${item.quant}\t\t${item.summ = String(item['summ']).replace('.', ',')}`);
        });
        const textToCopy = textMass.join('\n');

        // создем временное поле для копируемого текста
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = textToCopy;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        docCopyBtn.style.backgroundColor = '#24870f';
        docCopyBtn.textContent = 'Скопировано';
        setTimeout(() => {
          docCopyBtn.style.backgroundColor = '#6db3ff';
          docCopyBtn.textContent = 'Скопировать';
        }, 1500);
        document.body.removeChild(tempTextArea);
      });

      const docTable = document.createElement('table');
      docTable.classList.add('mb-3');
      docWrap.append(docTable);

      // функция очистки значений
      function tableClear() {
        docTable.innerHTML = '';
      };

      // функция добавления строк
      function addRow(code, quant, summ) {
        const docTr = document.createElement('tr');
        const docTd = [code, quant, summ];
        docTd.forEach(item => {
          const tdItem = document.createElement('td');
          tdItem.style.fontSize = '8px';
          tdItem.textContent = item;
          docTr.append(tdItem);
        })
        docTable.append(docTr);
      }

      addRow('код', 'кол-во', 'сумма');

      // если в накладной больше 3 номенклатур
      if (finalData[i].length > 3) {
        for (let j = 0; j < 3; j++) {
          addRow(finalData[i][j].code, finalData[i][j].quant, finalData[i][j].summ);
        };
        addRow('....');

        // кнопка сворачивания-разворачивания
        const docColapseBtn = document.createElement('button');
        docColapseBtn.classList.add('btn', 'btn-outline-secondary', 'btn-sm', 'mb-4');
        docColapseBtn.type = 'button';
        docColapseBtn.textContent = 'Развернуть';
        docWrap.append(docColapseBtn);

        let colapsed = true;
        docColapseBtn.addEventListener('click', () => {
          function open() {
            tableClear();
            addRow('код', 'кол-во', 'сумма');
            finalData[i].forEach(item => addRow(item.code, item.quant, item.summ));
            docColapseBtn.textContent = 'Свернуть';
            colapsed = false;
          }
          function close() {
            tableClear();
            addRow('код', 'кол-во', 'сумма');
            for (let j = 0; j < 3; j++) {
              addRow(finalData[i][j].code, finalData[i][j].quant, finalData[i][j].summ);
            };
            addRow('....');
            docColapseBtn.textContent = 'Развернуть';
            colapsed = true;
          }
          if (colapsed) open();
          else close();
        })
      } else {
        finalData[i].forEach(item => addRow(item.code, item.quant, item.summ));
      };

      // добавляем итоговую сумму
      const docSummWrap = document.createElement('div');
      docSummWrap.style.marginTop = 'auto';
      docWrap.append(docSummWrap);

      const docSummTitle = document.createElement('p');
      docSummTitle.textContent = 'Сумма документа:';
      docSummTitle.style.fontSize = '12px';
      docSummTitle.style.marginBottom = '5px';
      docSummWrap.append(docSummTitle);

      const docSumm = document.createElement('a');
      const summTotal = finalData[i].map(item => item.summ).reduce((acc, val) => acc + val).toFixed(2);
      if (isNaN(summTotal)) docSumm.textContent = '-';
      else docSumm.textContent = Number(summTotal).toLocaleString('ru');
      docSummWrap.append(docSumm);


      // проверяем чтобы сумма позиций соответствовала сумме накладной
      docSumm.setAttribute('data-bs-toggle', 'popover');
      docSumm.setAttribute('data-bs-placement', 'top');
      if (allSummValues[i] == summTotal) {
        docSumm.style.color = 'green';
        docSumm.setAttribute('data-bs-title', 'Сумма строк совпадает с итоговой');
      } else {
        docSumm.style.color = 'red';
        docSumm.setAttribute('data-bs-title', 'Сумма строк НЕ совпадает с итоговой. Проверьте документ.');
      };
      const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
      const popoverList = [...popoverTriggerList].map(popoverTriggerEl =>
        new bootstrap.Popover(popoverTriggerEl, {
          trigger: 'hover',
        })
      );
    };
    const docWarn = document.createElement('p');
    docWarn.style.width = '100%';
    docWarn.style.marginBottom = 0;
    docWarn.style.fontSize = '12px';
    docWarn.textContent = 'Примечание. Разворачивание строк - для информации, на копирование не влияет.'
    if (document.querySelector('.btn-outline-secondary')) docDiv.prepend(docWarn);
  };
});
