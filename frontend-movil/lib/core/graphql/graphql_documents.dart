import 'package:graphql_flutter/graphql_flutter.dart';

const meQuery = r'''
query Me {
  me { id name email createdAt }
}
''';

const loginMutation = r'''
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user { id name email createdAt }
  }
}
''';

const registerMutation = r'''
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    token
    user { id name email createdAt }
  }
}
''';

const itemsQuery = r'''
query GetItems($search: String) {
  items(search: $search) {
    id name category images basePrice
    auction { id currentPrice status endsAt }
  }
}
''';

const itemQuery = r'''
query GetItem($id: ID!) {
  item(id: $id) {
    id name description category images documents basePrice
    auction {
      id currentPrice status endsAt
      winningBid { id amount createdAt bidder { id name } }
      participants { id name }
    }
  }
}
''';

const auctionUpdatedSubscription = r'''
subscription AuctionUpdated($auctionId: ID!) {
  auctionUpdated(auctionId: $auctionId) {
    id currentPrice status endsAt
    winningBid { id amount createdAt bidder { id name } }
    participants { id name }
  }
}
''';

const placeBidMutation = r'''
mutation PlaceBid($auctionId: ID!, $amount: Float!) {
  placeBid(auctionId: $auctionId, amount: $amount) {
    id amount createdAt bidder { id name }
  }
}
''';

const walletQuery = r'''
query Wallet {
  wallet {
    userId available reserved
    movements {
      id type amount createdAt
      auction { id item { id name } }
    }
  }
}
''';

const depositMutation = r'''
mutation Deposit($amount: Float!, $promoCode: String!) {
  deposit(amount: $amount, promoCode: $promoCode) {
    userId available reserved
    movements {
      id type amount createdAt
      auction { id item { id name } }
    }
  }
}
''';

const updateUserMutation = r'''
mutation UpdateUser($input: UpdateUserInput!) {
  updateUser(input: $input) { id name email createdAt }
}
''';

const deleteUserMutation = r'''
mutation DeleteUser { deleteUser }
''';

QueryOptions queryOptions(String document, {Map<String, dynamic>? variables}) =>
    QueryOptions(document: gql(document), variables: variables ?? const {});

MutationOptions mutationOptions(
  String document, {
  Map<String, dynamic>? variables,
}) =>
    MutationOptions(document: gql(document), variables: variables ?? const {});
