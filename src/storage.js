
const DB_NAME = 'trpg-log-studio';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const PROJECT_KEY = 'current';

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('데이터베이스가 다른 창에서 사용 중입니다.'));
    });
}

async function runTransaction(mode, operation) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        let result;
        let transaction;

        try {
            transaction = db.transaction(STORE_NAME, mode);
            const store = transaction.objectStore(STORE_NAME);
            const request = operation(store);

            request.onsuccess = () => {
                result = request.result;
            };

            transaction.oncomplete = () => {
                db.close();
                resolve(result);
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };

            transaction.onabort = () => {
                db.close();
                reject(transaction.error || new Error('저장 작업이 취소되었습니다.'));
            };
        } catch (error) {
            db.close();
            reject(error);
        }
    });
}

export function loadProject() {
    return runTransaction('readonly', store => store.get(PROJECT_KEY));
}

export function saveProject(project) {
    return runTransaction('readwrite', store => store.put(project, PROJECT_KEY));
}