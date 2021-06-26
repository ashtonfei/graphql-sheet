# graphql-sheet

A GraphQL style query library for Google Sheet written with Google Apps Script

## Introduction on YouTube

^[Graphql Sheet Library (Preview)]()

## Demo Links

^[Demo Database with demo script](https://docs.google.com/spreadsheets/d/1qXB0NJRSRAonA1E9k5RsdsGy0Sl4Lat9c2ERqVPlU9o/copy)
^[Demo Web App Build](https://script.google.com/macros/s/AKfycbyb9LrwC85_-3rM7ejioZnEYjRfps_TLaJLd1qzIEaSivdzBmlJV_Mdwm8m3M7-jBUmQg/exec)
^[JSON download content service](https://script.google.com/macros/s/AKfycbyb9LrwC85_-3rM7ejioZnEYjRfps_TLaJLd1qzIEaSivdzBmlJV_Mdwm8m3M7-jBUmQg/exec?download=true)

## Add the library to your spreadsheet

```javascript
1AkIU9D7-QTAytM1m7gALogopMttzp7Ir8ArWU_7K7zSvq8ZIT_kj64m4
```

## Create a new database with Graphql

```javascript
function demo() {
	const id = SpreadsheetApp.getActive().getId();
	const db = new Graphql.create(id);

	const users = db.query(
		`query getActiveStatus($status:string!){
            users(status:$status){
                name
                status
                joinDate
                gender
                posts{
                    id
                    title
                    description
                    channels{
                        id
                        name
                        url
                    }
                }
            }
        }`,
		{ status: "active" }
	);
	console.log(users);
}
```
