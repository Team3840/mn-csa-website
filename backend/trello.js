// This is where the backend logic to handle creating a new trello card will go. 
// We will use the Trello API to create a new card based on the info submitted in the form.

const config = require("./config.json");
const trelloBoards = config.trelloBoards;
const trelloLabels = config.trelloBoardLabels;


// Some terms to understand:
// trelloId: This is the ID of the board or element instance as you see it in your browser URL bar when viewing the board. This is NOT the same as the board ID!
//           A trelloId can also be used as the ID for other things too, like lists, cards, labels. For example, a label's ID is a trelloId. This is just what trello calls these, they don't relate to each other.
//           This is what is stored in the config file and is used to lookup the boardId and other info. It's shorter, looks something like this: CxCc1Ofe
// boardId: This is the ID of the board as it is stored in Trello's database. These are longer and look something like this: 6596f1d9f2b262c8cef42fe4
//          This is is needed to make creation calls to the API, whereas we use the trelloId to lookup a boardId and some other items too, like getting labels.


// create a new card on the incoming list for the specified board based on event
async function createCard(title, teamNumber, frcEvent, problemCategory, priority, description, attachments) {
  // find the id of the board we want to create the card on according to the selected event
  const trelloId = trelloBoards.find(board => board.frontendEventSelection.toLowerCase() === frcEvent.toLowerCase()).trelloId;

  // find the id of the "incoming" list on the board so we can create the card there
  const listId = await getIncomingListIdOfBoard(trelloId);
  const formattedDescription = `**This is a submitted request that was added automatically**\n\nTeam Number: ${teamNumber}\n\nCategory: ${problemCategory}\n\nPriority: ${priority}\n\nDescription: ${description}`;

  // lookup the IDs of the labels we want to add to the card based on the selected category and priority
  const problemCategoryLabelId = await getLabelIdByName(trelloId, problemCategory);
  const priorityLabelId = await getLabelIdByName(trelloId, priority);

  // send the request to create the new card, it will be created at the top of the "incoming" list
  const res = await fetch(`https://api.trello.com/1/cards?key=${config.trelloAppKey}&token=${config.trelloUserToken}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      idList: listId,
      name: teamNumber + ": " + title,
      desc: formattedDescription,
      pos: 'top',
      start: new Date(),
      idLabels: [problemCategoryLabelId, priorityLabelId]
    })
  });

  if (res.ok) {
    const resJson = await res.json();
    console.log(resJson);
    console.log("Card created successfully");
  }
  else {
    console.log(`Error creating card on board ${trelloId} ---> ${res.status}: ${res.statusText}`);
    try {
      const errorResponse = await createRes.json();
      console.log('Error Details:', errorResponse);
    } catch (error) {
      console.error('Error parsing create label response:', error);
    }
  }
}



// verify that our configured labels exist on all our configured boards, create them if they don't 
async function verifyLabels() {
  for (const board of trelloBoards) {
    const trelloId = board.trelloId;
    const boardId = await getBoardIdByTrelloId(trelloId);
    // grab the labels currently present on the board, if any
    const res = await fetch(`https://api.trello.com/1/boards/${trelloId}/labels?key=${config.trelloAppKey}&token=${config.trelloUserToken}`);
    if (res.ok) {
      const resJson = await res.json();
      console.log(`Found ${resJson.length} labels on board ${trelloId}`);
      // iterate through each label in our local config
      for (const expectedLabel of trelloLabels) {
        // if we don't see our label on the board, create it
        if (!resJson.find(boardLabel => boardLabel.name.toLowerCase() === expectedLabel.name.toLowerCase())) {
          const res = await fetch(`https://api.trello.com/1/labels?key=${config.trelloAppKey}&token=${config.trelloUserToken}&name=${encodeURIComponent(expectedLabel.name)}&color=${expectedLabel.color}&idBoard=${boardId}`, {
            method: 'POST'
          });
          if (res.ok) {
            console.log(`Created label ${expectedLabel.name} on board ${trelloId}`);
          }
          else {
            console.log(`Error creating label ${expectedLabel.name} on board ${trelloId} ---> ${res.status}: ${res.statusText}`)
          }
        }
      }
    }
    else {
      console.log(`Error getting labels on board ${trelloId}`);
    }
  }
}



// lookup and return the list ID of the "incoming" list on the specified board
async function getIncomingListIdOfBoard(trelloId) {
  const res = await fetch(`https://api.trello.com/1/boards/${trelloId}/lists?key=${config.trelloAppKey}&token=${config.trelloUserToken}`);
  if (res.ok) {
    const resJson = await res.json();
    return resJson.find(list => list.name.toLowerCase() === "incoming").id;
  }
  else {
    return;
  }
}



// lookup and return the ID of the label with the specified name on the specified board
async function getLabelIdByName(trelloId, labelName) {
  const res = await fetch(`https://api.trello.com/1/boards/${trelloId}/labels?key=${config.trelloAppKey}&token=${config.trelloUserToken}`);
  if (res.ok) {
    const resJson = await res.json();
    const label = resJson.find(label => label.name.toLowerCase() === labelName.toLowerCase());
    if (label) {
      return label.id;
    }
    else {
      return;
    }
  }
  else {
    return;
  }
}



// lookup and return the ID of the board with the specified trelloId (we need these for card and label creation calls)
async function getBoardIdByTrelloId(trelloId) {
  const res = await fetch(`https://api.trello.com/1/boards/${trelloId}?key=${config.trelloAppKey}&token=${config.trelloUserToken}`);
  if (res.ok) {
    const resJson = await res.json();
    return resJson.id;
  }
  else {
    return;
  }
}



// nuke all labels on the board (start fresh) - make certain you intend to use this before calling it, it will wipe custom labels you added too!
async function deleteAllLabelsOnBoard(trelloId) {
  const res = await fetch(`https://api.trello.com/1/boards/${trelloId}/labels?key=${config.trelloAppKey}&token=${config.trelloUserToken}`);
  if (res.ok) {
    const resJson = await res.json();
    for (const label of resJson) {
      const res = await fetch(`https://api.trello.com/1/labels/${label.id}?key=${config.trelloAppKey}&token=${config.trelloUserToken}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        console.log(`Deleted label ${label.name} on board ${trelloId}`);
      }
      else {
        console.log(`Error deleting label ${label.name} on board ${trelloId} ---> ${res.status}: ${res.statusText}`)
      }
    }
  }
  else {
    console.log(`Error getting labels on board ${trelloId}`);
  }
}


module.exports = { createCard, verifyLabels, deleteAllLabelsOnBoard };
