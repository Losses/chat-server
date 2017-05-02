$(function() {
  const FADE_TIME = 150; // ms
  const TYPING_TIMER_LENGTH = 400; // ms

  // Initialize variables
  const $window = $(window);
  const $usernameInput = $('#usernameInput'); // Input for username
  const $emailInput = $('#emailInput');
  const $scrollButton = $('.scroll_button');

  const $messages = $('.messages'); // Messages area
  const $inputMessage = $('.inputMessage'); // Input message input box

  const $loginPage = $('.login.page'); // The login page
  const $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  let username;
  let connected = false;
  let typing = false;
  let lastTypingTime;
  let $currentInput = $usernameInput.focus();
  let inited = false;

  let socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message, { prepend: true });
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());
    email = cleanInput($emailInput.val().trim());

    // If the username is valid
    if (username && email) {
      // Tell the server your username
      socket.emit('add user', {
        username: username,
        email: email,
      });
    } else {
      alert('Invalid input!')
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    if(!data.initMsg && !inited){
      setTimeout(() => addChatMessage(data, options), 200);
      return false;
    }

    $messageContent = $(`
      <li class="mdl-list__item mdl-list__item--three-line">
        <span class="mdl-list__item-primary-content">
          <img class="material-icons  mdl-list__item-avatar" src= "https://secure.gravatar.com/avatar/${data.avatar}?s=40" alt="${data.username}"/>
          <span>${data.message}</span>
          <span class="mdl-list__item-text-body">${data.username}</span>
        </span>
      </li>
  `)

    addMessageElement($messageContent, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    //no idea about how to design this.
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    //no idea about how to design this.
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Keyboard events

  $('#login_form').submit((event) => {
    setUsername();
    event.defaultPrevented = true;
  });

  $('#send_form').submit((event) => {
    sendMessage();
    event.defaultPrevented = true;
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events
  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  $window.scroll(() => {
    if(window.scrollY > 20)
      $scrollButton.addClass('show');
    else
      $scrollButton.removeClass('show');
  });

  $scrollButton.click(() => {
    $("html,body").animate({scrollTop: 0}, 300, 'swing');
  })

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to my guestbook!";
    log(message, { prepend: true });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data, {prepend: true});
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined', { prepend: true });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left', { prepend: true });
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('disconnect', function () {
    log('you have been disconnected', { prepend: true });
  });

  socket.on('reconnect', function () {
    log('you have been reconnected', { prepend: true });
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', function () {
    log('attempt to reconnect has failed', { prepend: true });
  });

  socket.on('init done', () => inited = true);
  socket.on('allow enter', () => $loginPage.fadeOut());
  socket.on('login error', (data) => {
    $loginPage.fadeIn();
    alert(data);
  })
  socket.emit('recent message');

});
