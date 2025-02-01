const { GraphQLScalarType } = require('graphql');
const authorizeWithGithub = require('./lib');

const resolvers = {
    Query: {
        me: (parent, args, { currentUser }) => currentUser,
        totalPhotos: (parent, args, { db }) => db.collection('photos').estimatedDocumentCount(),
        allPhotos: (parent, args, { db }) => db.collection('photos').find().toArray(),
        totalUsers: (parent, args, { db }) => db.collection('users').estimatedDocumentCount(),
        allUsers: (parent, args, { db }) => db.collection('users').find().toArray()
    },

    Mutation: {
        postPhoto: async (parent, args, { db, currentUser }) => {
            if (!currentUser) {
                throw new Error('Only an authorized user can post a photo');
            }

            const newPhoto = {
                ...args.input,
                userID: currentUser.githubLogin,
                created: new Date()
            }

            const { insertedId } = await db.collection('photos').insertOne(newPhoto);

            newPhoto.id = insertedId;

            return newPhoto;
        },
        githubAuth: async (parent, { code }, { db }) => {
            const {
                message,
                access_token,
                avatar_url,
                login,
                name
            } = await authorizeWithGithub(
                {
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    code
                }
            );

            if (message) {
                throw new Error(message);
            }

            const latestUserInfo = {
                name,
                githubLogin: login,
                githubToken: access_token,
                avatar: avatar_url
            }

            await db.collection('users').replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true });

            const user = await db.collection('users').findOne({ githubLogin: login });

            return { user, token: access_token }
        },
        addFakeUsers: async (parent, { count }, { db }) => {
            const randomUserApi = `https://randomuser.me/api/?results=${count}`;

            const { results } = await fetch(randomUserApi).then(res => res.json());

            const users = results.map(r => ({
                githubLogin: r.login.username,
                name: `${r.name.first} ${r.name.last}`,
                avatar: r.picture.thumbnail,
                githubToken: r.login.sha1
            }))

            await db.collection('users').insertMany(users);

            return users;
        },
        fakeUserAuth: async (parent, { githubLogin }, { db }) => {
            const user = await db.collection('users').findOne({ githubLogin });

            if (!user) {
                throw new Error(`Cannot find user with githubLogin ${githubLogin}`)
            }

            return {
                token: user.githubToken,
                user
            }
        }
    },

    Photo: {
        id: parent => parent.id || parent._id,
        url: parent => `/img/photos/${parent._id}.jpg`,
        postedBy: (parent, args, { db }) => db.collection('users').findOne({ githubLogin: parent.userID }),
    },

    User: {
        postedPhotos: parent => {
            return photos.filter(p => p.githubUser === parent.githubLogin)
        },
        inPhotos: parent => tags.filter(tag => tag.userID === parent.id).map(tag => tag.photoID).map(photoID => photos.find(p => p.id === photoID))
    },
    DateTime: new GraphQLScalarType({
        name: "DateTime",
        description: "A valid date time value.",
        parseValue: value => new Date(value),
        serialize: value => new Date(value).toISOString(),
        parseLiteral: ast => ast.value
    })
};

module.exports = resolvers;