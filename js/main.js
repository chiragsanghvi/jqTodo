$(function () {
	Appacitive.session.environment = 'live';
	Appacitive.session.create({
		apikey: 'ukaAo61yoZoeTJsGacH9TDRHnhf/J9/kH2TStR5sD3k='
	});
});

Appacitive.eventManager.subscribe('session.success', function() {
	if ($) {
		$('#btnLogin').attr('disabled', false).attr('value', 'Log In');
		$('#btnRegister').attr('disabled', false).attr('value', 'Register');
	}
})

window.cache = {
	lists: []
}

var backgroundRefreshItems = function() {
	window.cache.lists.forEach(function (cachedList) {
		if (cachedList._itemsFetched == true) return;
		var lists = new Appacitive.ArticleCollection({ schema: 'todolists' });
		var list = lists.createNewArticle();
		list.set('__id', cachedList.__id);
		var items = list.getConnectedArticles({ relation: 'list_items' });
		items.fetch(function() {
			var itemArticles = [];
			items.getAll().forEach(function (item) {
				var itemArticle = item.connectedArticle.getArticle();
				itemArticles.push(itemArticle);
			});
			cachedList._itemsFetched = true;
			cachedList._items = [].concat(itemArticles);
		}, function() {
			// no error handling here
		});
	});
}

var register = function() {
	var username = $('#rusername').val().trim();
	//var password = Crypto.MD5($('#rpassword').val().trim());
	var password = $('#rpassword').val().trim();
	if (username.length == 0 || password.length == 0) {
		alert('Enter your email and password to login');
		return;
	}
	$('#rusername').val('');
	$('#rpassword').val('');

	var user = {
		email: username,
		password: password,
		firstname: username,
		username: username
	};

	$('#btnRegister').attr('value', 'Registering...').attr('disabled', true);
	Appacitive.Users.createUser(user, function() {
		$('#btnRegister').attr('value', 'Register').attr('disabled', false);
		$('#username').val(username);
		$('#password').val('');
		window.location.hash = '#login';
	}, function() {
		$('#btnRegister').attr('value', 'Register').attr('disabled', false);
		alert('A user already exists.');
	});
}

var login = function() {
	var username = $('#username').val().trim();
//	var password = Crypto.MD5($('#password').val().trim());
	var password = $('#password').val().trim();
	if (username.length == 0 || password.length == 0) {
		alert('Enter your email and password to login');
		return;
	}

	var creds = {
    	'username': username,
    	'password': password,
    	'expiry': -1,
    	'attempts': -1
    };
	$('#btnLogin').attr('value', 'Logging in...').attr('disabled', true);
    Appacitive.Users.authenticateUser(creds, function(data) {
    	Appacitive.session.setUserAuthHeader(data.token);
    	window.user = new Appacitive.Article(data.user);
		window.listMap = {};
		$('#btnLogin').attr('value', 'Fetching lists...').attr('disabled', true);
    	
    	fetchLists(function (lists) {
			backgroundRefreshItems();
			$('#btnLogin').attr('value', 'Log In').attr('disabled', false);
			renderLists(lists);
			setTimeout(function() {
				window.location.hash = 'lists';
			}, 10);
		}, function() {
			$('#btnLogin').attr('value', 'Log In').attr('disabled', false);
			alert('Could not retrieve your lists. Contact support.');
		});
    	
    }, function(data) {
    	$('#btnLogin').attr('value', 'Log In').attr('disabled', false);
		alert('Unknown username or password.');
    });

}

var fetchLists = function(onSuccess, onError) {
	var loggedInUser = window.user;
	var lists = loggedInUser.getConnectedArticles({ relation: 'user_lists' });
	var listArticles = [];
	lists.fetch(function() {
		lists.getAll().forEach(function (connection) {
			var listArticle = connection.connectedArticle.getArticle();
			listArticle._itemsFetched = false;
			listArticles.push(listArticle);
		});
		window.cache.lists.length = 0;
		window.cache.lists = window.cache.lists.concat(listArticles);
		onSuccess(listArticles);
	}, function() {
		(onError || function(){})();
	});
}

var backgroundSyncLists = function() {

	// fetch the lists and update
	var loggedInUser = window.user;
	var lists = loggedInUser.getConnectedArticles({ relation: 'user_lists' });
	var listArticles = [];
	lists.fetch(function() {
		lists.getAll().forEach(function (connection) {
			var listArticle = connection.connectedArticle.getArticle();
			listArticle._itemsFetched = false;
			listArticles.push(listArticle);
		});

		// now figure out which lists have been added
		// and then add them to the cache
		listArticles.forEach(function (list, index) {
			var existsInCache = window.cache.lists.filter(function (cachedList) {
				return cachedList.__id == list.__id;
			}).length == 1;
			if (existsInCache == false) {
				window.cache.lists.splice(0, 0, list)
			}
		});

		// now figure out which lists have been removed
		// and remove them from the cache
		var tempArray = [];
		window.cache.lists.forEach(function (cachedList, index) {
			var existsInDb = listArticles.filter(function (list) {
				return list.__id == cachedList.__id;
			}).length == 1;
			if (existsInDb == true) {
				tempArray.push(cachedList);
			}
		});
		window.cache.lists = tempArray;
		backgroundRefreshItems();

		// render if on lists view
		if (window.location.hash == '#lists') {
			renderLists(window.cache.lists);
		}
	});

}

var renderLists = function(lists) {
	var container = $('#ulListNames').empty();
	var html = '', buttonHtml = '';
	lists.forEach(function (list) {
		buttonHtml = '<button style="float: right; margin-right: 20px; display: none;" data-id="';
		buttonHtml += list.__id;
		buttonHtml += '" data-entity="todolists" class="button">Delete</button>';
		html += '<li class="arrow has-delete-button"><a class="list-name-display" data-listid="' + list.__id + '" href="javascript:void(0)">' + list.list_name + '</a>'
		html += buttonHtml + '</li>';
	});
	container.html(html);
}

var fetchListItems = function(onSuccess, onError) {
	// get the list from the global cache
	// its safe to assume that it'll always be present
	var parentList = window.cache.lists.filter(function (list) {
		return list.__id == window.listId;
	})[0];

	// get from cache if possible
	if (parentList._itemsFetched == true) {
		onSuccess(parentList._items);
		return;
	}

	// fetch list items and cache
	var lists = new Appacitive.ArticleCollection({ schema: 'tasks' });
	var list = lists.createNewArticle();
	list.set('__id', window.listId);
	var items = list.getConnectedArticles({ relation: 'list_items' });
	items.fetch(function() {
		var itemArticles = [];
		items.getAll().forEach(function (item) {
			var itemArticle = item.connectedArticle.getArticle();
			itemArticles.push(itemArticle);
		});
		parentList._itemsFetched = true;
		parentList._items = [].concat(itemArticles);
		onSuccess(itemArticles);
	}, (onError || function(){}));
}

var renderListItems = function(listItems) {
	var container = $('#ulListItems').empty();
	var html = '', buttonHtml = '', iClass = '';
	listItems.forEach(function (listItem) {
		buttonHtml = '<button style="float: right; margin-right: 20px; display: none;" data-id="';
		buttonHtml += listItem.__id;
		if (listItem.completed_at && listItem.completed_at.length>0) iClass = 'item-done'; else iClass = '';
		buttonHtml += '" data-entity="tasks" class="button">Delete</button>';
		html += '<li class="has-delete-button"><a href="javascript:void(0)" class="list-item-link ' + iClass + '">' + listItem.text + buttonHtml + '</a></li>';
	});
	$('#listItems h1').html(window.listName);
	container.html(html);
}

$('#btnLogin').live('click', login);
$('#btnRegister').live('click', register);

$('.list-name-display').live('click', function() {
	window.listId = $(this).attr('data-listid');
	window.listName = $(this).html();
	fetchListItems(function (items) {
		renderListItems(items);
		window.location.hash = 'listItems';
	}, function() {
		alert('Could not fetch list items, contact support.');
	});
});

$('.list-item-link').live('click', function() {
	var $this = $(this), newValue = null;
	if ($this.hasClass('item-done')) {
		newValue = false;
	} else {
		newValue = true;
	}
	// update the UI
	$this.toggleClass('item-done');

	// change in the cache
	var listId = null
		, itemId = $this.find('button').attr('data-id')
		, itemIndex = null;
	window.cache.lists.forEach(function (list, lId) {
		if (list._items && list._items.length) {
			list._items.forEach(function (item, index) {
				if (item.__id == itemId) {
					itemIndex = index;
					listId = lId;
				}
			});
		}
	});
	window.cache.lists[listId]._items[itemIndex].status = newValue;

	// finally, write to the api
	var items = new Appacitive.ArticleCollection({ schema: 'item' });
	var item = items.createNewArticle({ __id: itemId });
	item.fetch(function() {
		item.set('status', newValue + '');
		item.save(function() {
			// nothing to do here
		}, function() {
			// some error handling
		});
	});
});

$('.has-delete-button').live('swipe', function(event, info){
	if (info && info.direction && info.direction == 'right') return;
	if ($(this).find('button').is(':visible')) {
		$(this).find('button').fadeOut();
		$('.has-delete-button button').hide();
	} else {
		$('.has-delete-button button').hide();
		$(this).find('button').fadeIn();
	}
});

// delete functionality
$('.has-delete-button button').live('click', function() {
	var entity = $(this).data().entity, id = $(this).attr('data-id');
	
	// remove from cache and redirect
	var indexToRemove = null;
	if (entity == 'list') {
		window.cache.lists.forEach(function (list, index) {
			if (list.__id == id) {
				indexToRemove = index;
			}
		});
		window.cache.lists.splice(indexToRemove, 1);
		renderLists(window.cache.lists);
	} else {
		var listId = null;
		window.cache.lists.forEach(function (list, lId) {
			if (list._items && list._items.length) {
				list._items.forEach(function (item, index) {
					if (item.__id == id) {
						indexToRemove = index;
						listId = lId;
					}
				});
			}
		});
		window.cache.lists[listId]._items.splice(indexToRemove, 1);
		if (window.cache.lists[listId]._items.length > 0) {
			renderListItems(window.cache.lists[listId]._items);
		} else {
			renderLists(window.cache.lists);
			setTimeout(function() {
				window.location.hash = 'lists';
			}, 10);
		}
	}

	var entities = new Appacitive.ArticleCollection({ schema: entity });
	var entity = entities.createNewArticle({ __id: id });
	entity.del(function() {
		// do nothing
	}, function() {
		// alert('Error while deleting');
	}, {
		deleteConnections: true
	});
});

$('#btnCreateList').live('click', function() {
	var $this = $(this);
	$('#txtListname').focus();
	$this.attr('value', 'Saving...').attr('disabled', true);

	var lists = new Appacitive.ArticleCollection({ schema: 'todolists' });
	var list = lists.createNewArticle();
	list.set('list_name', $('#txtListname').val().trim());
	list.save(function() {

		// first update the cache
		var cachedList = list.getArticle();
		cachedList._items = [];
		cachedList._itemsFetched = true;
		window.cache.lists.splice(0, 0, cachedList);

		// now render
		window.listName = $('#txtListname').val();
		window.listId = cachedList.__id;
		renderListItems([]);
		renderLists(window.cache.lists);

		// and reset the UI
		$this.attr('value', 'Save').attr('disabled', false);
		$('#txtListname').val('');

		// and redirect
		setTimeout(function() {
			window.location.hash = 'listItems';
		}, 10);

		// now we create the connection
		var connectOptions = {
	        __endpointa: {
	            articleid: window.user.get('__id'),
	            label: 'user'
	        },
	        __endpointb: {
	            articleid: list.get('__id'),
	            label: 'todolists'
	        }
	    };
	    var cC = new Appacitive.ConnectionCollection({ relation: 'user_lists' });
	    var connection = cC.createNewConnection(connectOptions);
	    connection.save(function() {
	    	// nothing to do here
	    }, function() {
	    	// alert('Could not save list, contact support.');
	    });
	}, function() {
		// alert('Could not save list, contact support.');
	});
});

$('#btnCreateListItem').live('click', function() {
	var $this = $(this);
	$('#txtListItem').focus();
	$this.attr('value', 'Creating...').attr('disabled', true);

	// actually save in the API
	var items = new Appacitive.ArticleCollection({ schema: 'tasks' });
	var item = items.createNewArticle();
	item.set('text', $('#txtListItem').val().trim());
	item.save(function() {

		$('#txtListItem').val('');
		$this.attr('value', 'Save').attr('disabled', false);


		// update in the cache and render
		// before creating the connection
		var listItems = window.cache.lists.filter(function (list) {
			return list.__id == window.listId;
		})[0]._items;
		listItems.splice(0, 0, item.getArticle());
		renderListItems(listItems);
		setTimeout(function() {
			window.location.hash = 'listItems';
		}, 10);

		// create the connection
		var connectOptions = {
	        __endpointa: {
	            articleid: window.listId,
	            label: 'todolists'
	        },
	        __endpointb: {
	            articleid: item.get('__id'),
	            label: 'tasks'
	        }
	    };
	    var cC = new Appacitive.ConnectionCollection({ relation: 'list_items' });
	    var connection = cC.createNewConnection(connectOptions);
	    connection.save(function() {
	    	// do nothing, trust the cache to have worked properly
	    }, function() {
	    	// alert('Could not create item, contact support.');
	    });
	}, function() {
		// alert('Could not create item, contact support.');
	});
});

$(function() {
	if (window.location.hash != '' && window.location.hash != '#' && window.location.hash != '#login')
		window.location.hash = '#login';
});
