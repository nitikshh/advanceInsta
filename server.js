const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const app = express();
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/users', express.static(path.join(__dirname, 'users')));



// Set storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.cookies.username || 'default_username'; // Set a default username if not found
    const imagesDir = path.join(__dirname, 'users', username, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});



app.post('/saveData', (req, res) => {
  const { username, email, password } = req.body;

  // Check if the username contains any uppercase letters
  const hasUpperCase = /[A-Z]/.test(username);
  if (hasUpperCase) {
    const errorMessage = 'Enter the Lower Case Only';
    return res.redirect(`/error?message=${errorMessage}`);
  }

  // Check if the username contains any spaces
  const hasSpaces = /\s/.test(username);
  if (hasSpaces) {
    const errorMessage = 'Username cannot contain spaces';
    return res.redirect(`/error?message=${errorMessage}`);
  }

  const usersDir = path.join(__dirname, 'users');
  if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir);
  }

  // Check if the username already exists in the users directory
  const userDir = path.join(usersDir, username);
  if (fs.existsSync(userDir)) {
    const errorMessage = 'Username already exists';
    return res.redirect(`/error?message=${errorMessage}`);
  }

  fs.mkdirSync(userDir);

  const dataToWrite = `Username: ${username}\nPassword: ${password}\nEmail: ${email}`;
  fs.writeFileSync(path.join(userDir, 'data.txt'), dataToWrite);

  res.redirect('/loginUser');
});








// Function to get the sender's username from the file
function getSenderUsername() {
  const usernames = req.cookies.username;
  return usernames[0]; // Assuming the sender's username is the first line
}


app.post('/postComment', (req, res) => {
  const { postId, comment, username } = req.body;
  const senderUsername = getSenderUsername();

  if (!postId || !comment || !username || !senderUsername) {
    res.status(400).send('Incomplete data. Please provide postId, comment, username, and senderUsername.');
    return;
  }

  const { v4: uuidv4 } = require('uuid');
  const commentId = uuidv4();

  const fileNameWithoutExtension = postId.split('.').slice(0, -1).join('.');
  const postDirectory = path.join(__dirname, 'users', username, 'post', fileNameWithoutExtension);
  const filePath = path.join(postDirectory, 'data.txt'); // Updated path to include the 'data.txt' file

  const commentData = `CommentId: ${commentId}\nUsername: ${username}\nComment: ${comment}\nSenderUsername: ${senderUsername}`;
  const commentDataWithSeparator = `\n\n${commentData}`;

  // Check if the directory already exists, if not, create it
  if (!fs.existsSync(postDirectory)) {
    fs.mkdirSync(postDirectory, { recursive: true });
  }

  // Check if the file already exists, if not, create it
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, commentDataWithSeparator, 'utf-8');
  } else {
    fs.appendFileSync(filePath, commentDataWithSeparator, 'utf-8');
  }

  res.sendStatus(200);
});






app.post('/deleteComment', (req, res) => {
  const { commentId, postImagePath } = req.body;

  if (!commentId || !postImagePath) {
    res.status(400).send('Incomplete data. Please provide commentId and postImagePath.');
    return;
  }

  const fs = require('fs');
  const path = require('path');

  // Extract the username from the postImagePath
  const usernameMatch = postImagePath.match(/^users\/([^/]+)/);
  if (!usernameMatch) {
    res.status(400).send('Invalid postImagePath format.');
    return;
  }

  const username = usernameMatch[1]; // Extracted username
  const filePath = path.join(__dirname, 'users', username, 'post', `${path.basename(postImagePath, path.extname(postImagePath))}`, 'data.txt'); // Updated file path to point to data.txt

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading comments:', err);
      res.status(500).send('Error reading comments');
      return;
    }

    const comments = data.split('\n\n');
    let commentFound = false;

    // Filter out the comment with the provided commentId
    const filteredComments = comments.filter(commentBlock => {
      const commentData = {};
      commentBlock.split('\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          commentData[key.trim()] = value.trim();
        }
      });

      if (commentData['CommentId'] === commentId) {
        commentFound = true;
        return false;
      }

      return true;
    });

    if (!commentFound) {
      res.status(404).send('Comment not found');
      return;
    }

    // Update the file with the filtered comments
    fs.writeFile(filePath, filteredComments.join('\n\n'), (err) => {
      if (err) {
        console.error('Error deleting comment:', err);
        res.status(500).send('Error deleting comment');
      } else {
        res.sendStatus(200);
      }
    });
  });
});






app.get('/getComments', (req, res) => {
  const { username, postImagePath } = req.query;
  const postFilePath = path.join(__dirname, 'users', username, 'post', `${path.basename(postImagePath, path.extname(postImagePath))}`, 'data.txt'); // Updated file path to point to data.txt

  fs.readFile(postFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error fetching comments:', err);
      res.status(500).send('Error fetching comments');
    } else {
      const comments = [];
      const commentBlocks = data.split('\n\n');

      commentBlocks.forEach(commentBlock => {
        const commentData = {};
        const lines = commentBlock.split('\n');
        lines.forEach(line => {
          const [key, value] = line.split(':');
          if (key && value) {
            commentData[key.trim()] = value.trim();
          }
        });
        if (Object.keys(commentData).length !== 0) {
          comments.push(commentData);
        }
      });

      res.send(comments);
    }
  });
});
















const os = require('os');

// Route to handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body || {}; // Adding a default empty object for destructuring

  if (!username) {
    return res.status(400).send('Username is missing in the request.');
  }
  // Check if the username contains any uppercase letters
  const hasUpperCase = /[A-Z]/.test(username);
  if (hasUpperCase) {
    const errorMessage = 'Enter the Lower Case Only';
    // Redirect to the error route with the error message as a query parameter
    return res.redirect(`/error?message=${errorMessage}`);
  }

// Setting the cookie at the root path of the domain
res.cookie('username', username, { maxAge: 900000, httpOnly: true, path: '/' });

  // Read data from the file
  fs.readFile(path.join('users', username, 'data.txt'), 'utf8', (err, data) => {
    if (err) {
      res.send('Invalid username or password');
    } else {
      const storedPassword = data.split('\n')[1].split(': ')[1];
      if (password === storedPassword) {
        // Redirect to main.html with the username as a query parameter
        res.redirect(`/main?username=${username}`);
      } else {
        res.send('Invalid username or password');
      }
    }
  });
});







const _ = require('lodash');

app.get('/getAllPosts', (req, res) => {
  const mainFolder = path.join(__dirname, 'users');
  const users = fs.readdirSync(mainFolder);

  let allPosts = [];

  users.forEach(user => {
    const userFolder = path.join(mainFolder, user, 'post');
    if (fs.existsSync(userFolder)) {
      const userPosts = fs.readdirSync(userFolder);
      userPosts.forEach(post => {
        const postFile = path.join(userFolder, post, 'data.txt'); // Update to include the data file
        const postContent = fs.readFileSync(postFile, 'utf-8');
        const lines = postContent.split('\n');
        if (lines.length >= 4) {
          const usernameLine = lines.find(line => line.startsWith('Username:'));
          const descriptionLine = lines.find(line => line.startsWith('Description:'));
          const profileImagePathLine = lines.find(line => line.startsWith('Profile Image Path:'));
          const imagePathLine = lines.find(line => line.startsWith('Post Image Path:'));

          if (usernameLine && descriptionLine && profileImagePathLine && imagePathLine) {
            const username = usernameLine.split(':').slice(1).join(':').trim();
            const description = descriptionLine.split(':').slice(1).join(':').trim();
            const profileImagePath = profileImagePathLine.split(':').slice(1).join(':').trim();
            const imagePath = imagePathLine.split(':').slice(1).join(':').trim();

            allPosts.push({
              username,
              description,
              profileImagePath,
              imagePath,
            });
          } else {
            console.error('Data format error in file:', postFile);
          }
        } else {
          console.error('Data format error in file:', postFile);
        }
      });
    }
  });

  // Shuffle the allPosts array
  allPosts = _.shuffle(allPosts);

  res.json(allPosts);
});





app.get('/getuserPost', (req, res) => {
  const username = req.query.username;



  if (!username) {
    res.send('Username not found');
    return;
  }

  const userFolder = path.join(__dirname, 'users', username, 'post');
  if (!fs.existsSync(userFolder)) {
    res.json([]);
    return;
  }

  const userPosts = fs.readdirSync(userFolder);
  const allPosts = [];

  userPosts.forEach(post => {
    const postFile = path.join(userFolder, post, 'data.txt'); // Updated path to include 'data.txt'
    const postContent = fs.readFileSync(postFile, 'utf-8');
    const lines = postContent.split('\n');

    const postObject = {
      username: '',
      description: '',
      profileImagePath: '',
      imagePath: '',
    };

    lines.forEach(line => {
      const [key, value] = line.split(':').map(item => item.trim());
      if (key === 'Username') {
        postObject.username = value;
      } else if (key === 'Description') {
        postObject.description = value;
      } else if (key === 'Profile Image Path') {
        postObject.profileImagePath = value;
      } else if (key === 'Post Image Path') {
        postObject.imagePath = value;
      }
    });

    allPosts.push(postObject);
  });

  res.json(allPosts);
});





app.get('/getProfileImagePath', (req, res) => {
  const username =  req.cookies.username;
  const profileImagesDir = path.join('users', username, 'images', 'profile');
  let imagePath = 'No profile photo found.';

  if (fs.existsSync(profileImagesDir)) {
    const files = fs.readdirSync(profileImagesDir);
    if (files.length > 0) {
      imagePath = `${profileImagesDir}/${files[0]}`;
    }
  }

  res.send(imagePath);
});


// ... (existing code for other functionalities)
const upload_profile = multer({ storage: storage });
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.cookies.username;
    const profileImagesDir = path.join(__dirname, 'users', username, 'images', 'profile');
    if (!fs.existsSync(profileImagesDir)) {
      fs.mkdirSync(profileImagesDir, { recursive: true });
    } else {
      const files = fs.readdirSync(profileImagesDir);
      for (const file of files) {
        const filePath = path.join(profileImagesDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Remove previous profile photo
        }
      }
    }
    cb(null, profileImagesDir);
  },
  filename: (req, file, cb) => {
    const username = req.cookies.username;
    const filename = `${username}${path.extname(file.originalname)}`;
    cb(null, filename);
  }
});

const uploadProfile = multer({ storage: profileStorage });

app.post('/uploadProfilePhoto', uploadProfile.single('profilePhoto'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No profile photo uploaded.');
  }
  const imagePath = req.file.path;
  res.send(imagePath);
});





const upload = multer({ storage: storage });
app.post('/addPost', upload.single('image'), (req, res) => {
  const { description } = req.body || {};
  const username = req.cookies.username; // Retrieve username from cookies

  if (!username) {
    res.send('Username not found');
    return;
  }

  // Change the path for the profile image to include the username as the filename
  const min = 100;
  const max = 1000;
  const profileImagePath = `users/${username}/images/profile/${username}.jpg`;
  const timestamp = Date.now();
  const imageName = req.file.originalname.split('.').slice(0, -1).join('.');
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
  const postImagePath = `users/${username}/images/${imageName}_${randomNumber}.${req.file.originalname.split('.').pop()}`;
  const dataToWrite = `Username: ${username}\nDescription: ${description}\nProfile Image Path: ${profileImagePath}\nPost Image Path: ${postImagePath}`;

  const imagesDir = path.join(__dirname, 'users', username, 'images');
  const postDir = path.join(__dirname, 'users', username, 'post', `${imageName}_${randomNumber}`);

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  if (!fs.existsSync(postDir)) {
    fs.mkdirSync(postDir, { recursive: true });
  }

  const imagePathInDir = path.join(imagesDir, `${imageName}_${randomNumber}.${req.file.originalname.split('.').pop()}`);
  fs.renameSync(req.file.path, imagePathInDir);

  fs.writeFileSync(path.join(postDir, 'data.txt'), dataToWrite);
  res.redirect(`/main`);
});









app.get('/useraccounturl', (req, res) => {
  const username = req.query.user;
  const imagePath = path.join(__dirname, 'users', username, 'images', 'profile', `${username}.jpg`);
  const defaultImagePath = 'https://www.bytewebster.com/img/logo.png'; // Default image path

  // Check if the profile image exists, if not, use the default image
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'images', 'default_profile.jpg')); // Sending a default image if the user's profile image doesn't exist
  }
});





app.get('/main', (req, res) => {
  const username = req.cookies.username; // Retrieve username from cookies

  if (!username) {
    res.send('Username not found');
    return;
  }

  const mainHTML = path.join(__dirname, 'main.html');
  fs.readFile(mainHTML, 'utf8', (err, mainData) => {
    if (err) {
      res.send('Error reading main HTML data');
    } else {
      const modifiedMainData = mainData.replace('{username}', username);
      res.send(modifiedMainData);
    }
  });
});



app.get('/getUsername', (req, res) => {
  const username = req.cookies.username; // Retrieve username from cookies
console.log('username -- ',username)
  if (!username) {
    res.status(500).send('Username not found');
    return;
  }

  res.send(username);
});





app.post('/follow', (req, res) => {
  const followedUser = req.body.followedUser;
  console.log('Followed User:', followedUser);

  const fs = require('fs');
  const path = require('path');

  const loginFilePath = req.cookies.username;
  let followerUsername = '';

  try {
    followerUsername = req.cookies.username;
    console.log('Follower Username:', followerUsername);

    const profilePhotoAbsolutePath = path.join(__dirname, 'users', followerUsername, 'images', 'profile', `${followerUsername}.jpg`);
    const relativePath = path.relative(__dirname, profilePhotoAbsolutePath);
    console.log('Profile Photo Path:', relativePath);

    const followersDir = path.join(__dirname, 'users', followedUser, 'followers');
    console.log('Followers Directory:', followersDir);

    if (!fs.existsSync(followersDir)) {
      try {
        fs.mkdirSync(followersDir, { recursive: true });
      } catch (err) {
        console.error('Error creating followers directory:', err);
        res.status(500).send('Error creating followers directory');
        return;
      }
    }

    const followerData = { username: followerUsername, profilePhoto: relativePath };

    const followerDataFilePath = path.join(followersDir, `${followerUsername}.json`);
    fs.writeFile(followerDataFilePath, JSON.stringify(followerData), (err) => {
      if (err) {
        console.error('Error saving follower data:', err);
        res.status(500).send('Error saving follower data');
      } else {
        console.log('Follower data saved successfully');
        res.send('Follower data saved successfully');
      }
    });
  } catch (err) {
    console.error('Error reading login data:', err);
    res.status(500).send('Error reading login data');
  }
});








app.get('/globalfollowers', (req, res) => {
  const usersPath = path.join(__dirname, 'users');
  fs.readdir(usersPath, (err, users) => {
    if (err) {
      console.error('Error reading user directory', err);
      res.send('Error reading user directory');
    } else {
      const followersData = [];
      users.forEach((user, index) => {
        if (user !== 'login.txt' && user !== 'default_username') {
          const profileImagePath = `/users/${user}/images/profile/${user}.jpg`;
          const followerData = {
            username: user,
            profilePhoto: profileImagePath
          };
          followersData.push(followerData);
        }
      });
      res.json(followersData);
    }
  });
});

app.get('/getFollowersData', (req, res) => {
  const username = req.query.username;
  const followersDir = path.join(__dirname, 'users', username, 'followers');

  if (!fs.existsSync(followersDir)) {
    res.json([]); // Return an empty array if the directory doesn't exist
    return;
  }

  const followersData = [];
  const followerFiles = fs.readdirSync(followersDir);

  followerFiles.forEach(file => {
    const filePath = path.join(followersDir, file);
    const followerData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    followersData.push(followerData);
  });

  res.json(followersData);
});

app.get('/checkuserlogin', (req, res) => {
  const username = req.query.username;
  console.log(username);
  const loginFilePath = req.cookies.username;

  try {
    const loginData = fs.readFileSync(loginFilePath, 'utf8').trim();
    if (username === loginData) {
      res.send('true');
    } else {
      res.send('false');
      console.log('False');
    }
  } catch (err) {
    console.error('Error reading login data:', err);
    res.send('false');
  }
});





app.delete('/deletePost', (req, res) => {
  const { username, folder } = req.query;
  const loginFilePath = req.cookies.username;

  try {
    const loginData = fs.readFileSync(loginFilePath, 'utf8').trim();

    if (username === loginData) {
      const folderParts = folder.split("/");
      const folderName = folderParts[folderParts.length - 1];
      const postFolderPath = path.join(__dirname, 'users', username, 'post', folderName);
      console.log(postFolderPath);

      if (fs.existsSync(postFolderPath)) {
        fs.rm(postFolderPath, { recursive: true }, (err) => {
          if (err) {
            console.error('Error deleting post folder:', err);
            res.status(500).send('Error deleting post folder');
          } else {
            console.log('Post folder deleted successfully');
            res.send('Post folder deleted successfully');
          }
        });
      } else {
        console.error('Post folder not found');
        res.status(404).send('Post folder not found');
      }
    } else {
      console.error('Username does not match login data');
      res.status(403).send('Username does not match login data');
    }
  } catch (err) {
    console.error('Error reading login data:', err);
    res.status(500).send('Error reading login data');
  }
});

app.get('/posts', (req, res) => {
  const { username } = req.query;
  const postsPath = path.join(__dirname, 'users', username, 'post');

  fs.readdir(postsPath, (err, files) => {
    if (err) {
      console.error('Error reading posts directory', err);
      res.send('Error reading posts directory');
    } else {
      // Filter out any non-folder entries
      const folderCount = files.filter(file => fs.statSync(path.join(postsPath, file)).isDirectory()).length;

      const responseData = {
        count: folderCount
      };
      res.json(responseData);
    }
  });
});


app.get('/followers-count', (req, res) => {
  const username = req.query.username;
  const followersPath = path.join(__dirname, 'users', username, 'followers');

  fs.readdir(followersPath, (err, followers) => {
    if (err) {
      console.error('Error reading followers directory', err);
      res.send('Error reading followers directory');
    } else {
      const followersCount = followers.length;
      res.send({ count: followersCount });
    }
  });
});



app.get('/checkuser', (req, res) => {
  const username = req.query.user; // Extracting the username directly from the query parameters
  const usersPath = path.join(__dirname, 'users');

  fs.readdir(usersPath, (err, users) => {
    if (err) {
      console.error('Error reading users directory', err);
      res.send(false); // Sending false in case of an error
    } else {
      const exists = users.includes(username);
      res.send(exists); // Sending true or false based on username existence
      console.log(exists);
    }
  });
});









app.post('/createMessageFolder', async (req, res) => {
  const { user, loginuser } = req.body;

  try {
    const userFolderPath = path.join(__dirname, 'users', loginuser, 'messages');
    const receiverFolderPath = path.join(__dirname, 'users', user, 'messages');

    await fs.promises.mkdir(userFolderPath, { recursive: true });
    await fs.promises.mkdir(receiverFolderPath, { recursive: true });

    const userFilePath = path.join(userFolderPath, `${user}.json`);
    const receiveruserFilePath = path.join(receiverFolderPath, `${loginuser}.json`);

    if (!fs.existsSync(userFilePath)) {
      const defaultData = {
        messages: [{
          sender: "",
          receiver: "",
          placedAt: "right",
          message: "Hello"
        }],
        profileImagePath: `users/${user}/images/profile/${user}.jpg`
      };

      const jsonData = JSON.stringify(defaultData, null, 2);
      await fs.promises.writeFile(userFilePath, jsonData);

      if (!fs.existsSync(receiveruserFilePath)) {
        const receiverdefaultData = {
          messages: [{
            sender: "",
            receiver: "",
            placedAt: "right",
            message: "Hello"
          }],
          profileImagePath: `users/${loginuser}/images/profile/${loginuser}.jpg`
        };
        const receiverjsonData = JSON.stringify(receiverdefaultData, null, 2);
        await fs.promises.writeFile(receiveruserFilePath, receiverjsonData);
      }
      res.send('Message file created successfully.');
    } else {
      res.send('Message file already exists.');
    }
  } catch (error) {
    console.error('Error creating message file:', error);
    res.status(500).send('Error creating message file');
  }
});









app.get('/getMessagesFolderContents', (req, res) => {
  const { username } = req.query;
  const messagesFolderPath = path.join(__dirname, 'users', username, 'messages');

  if (fs.existsSync(messagesFolderPath)) {
    fs.readdir(messagesFolderPath, (err, files) => {
      if (err) {
        console.error('Error reading message folder contents:', err);
        res.status(500).send('Error reading message folder contents');
      } else {
        const fileNames = files.map(file => file.replace('.json', ''));
        console.log('Message folder contents:', fileNames);
        res.json(fileNames);
      }
    });
  } else {
    console.log('Message folder does not exist.');
    res.json([]);
  }
});


// Server-side code to handle the getMessage request
app.get('/getMessage', (req, res) => {
  const { username } = req.query;
  const user = req.cookies.username;
  const filePath = path.join(__dirname, 'users', `${user}`, 'messages', `${username}.json`);
  console.log('filePath',filePath)

  if (fs.existsSync(filePath)) {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading message data:', err);
        res.status(500).send('Error reading message data');
      } else {
        const fileData = JSON.parse(data);
        res.json(fileData);
      }
    });
  } else {
    console.log('File does not exist.');
    res.json({});
  }
});




app.post('/saveMsg', async (req, res) => {
  try {
    const { username } = req.query;
    const messagesFilePath = path.join(__dirname, 'users', `${req.body.sender}`, 'messages', `${req.body.receiver}.json`);
    const receivermessagesFilePath = path.join(__dirname, 'users', `${req.body.receiver}`, 'messages', `${req.body.sender}.json`);

    // Saving the data for the receiver
    if (fs.existsSync(receivermessagesFilePath)) {
      const receiverfileData = JSON.parse(fs.readFileSync(receivermessagesFilePath, 'utf8'));
      receiverfileData.messages.push({
        "sender": req.body.sender,
        "receiver": req.body.receiver,
        "placedAt": "left",
        "message": req.body.message
      });
      await fs.promises.writeFile(receivermessagesFilePath, JSON.stringify(receiverfileData, null, 2));
      console.log('Message saved successfully for the receiver.');
      res.send('Message saved successfully for the receiver.');
    } else {
      console.log('Messages file does not exist for the receiver.');
      res.status(404).send('Messages file does not exist for the receiver.');
    }

    // Saving the data for the sender
    if (fs.existsSync(messagesFilePath)) {
      const fileData = JSON.parse(fs.readFileSync(messagesFilePath, 'utf8'));
      fileData.messages.push({
        "sender": req.body.sender,
        "receiver": req.body.receiver,
        "placedAt": "right",
        "message": req.body.message
      });
      await fs.promises.writeFile(messagesFilePath, JSON.stringify(fileData, null, 2));
      console.log('Message saved successfully for the sender.');
      res.send('Message saved successfully for the sender.');
    } else {
      console.log('Messages file does not exist for the sender.');
      res.status(404).send('Messages file does not exist for the sender.');
    }
  } catch (error) {
    console.error('Error handling the request:', error);
    res.status(500).send('Internal server error');
  }
});









// Route to handle the root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/loginUser', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/main', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});
app.get('/add', (req, res) => {
  res.sendFile(path.join(__dirname, 'add.html'));
});
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'profile.html'));
});
app.get('/error', (req, res) => {
  res.sendFile(path.join(__dirname, 'error.html'));
});
app.get('/userprofile', (req, res) => {
  res.sendFile(path.join(__dirname, 'userProfile.html'));
});

app.get('/messages', (req, res) => {
  res.sendFile(path.join(__dirname, 'messages.html'));
});





const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
