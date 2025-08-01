import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class TodoInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table for todos
    const todoTable = new dynamodb.Table(this, 'TodoTable', {
      tableName: 'todos',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change to RETAIN for production
    });

    // Common Lambda execution role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions to Lambda role
    todoTable.grantReadWriteData(lambdaExecutionRole);

    // Add explicit DynamoDB permissions
    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:ListTables'
      ],
      resources: [
        todoTable.tableArn,
        `${todoTable.tableArn}/*`
      ]
    }));

        // Lambda function for creating todos
    const createTodoFunction = new lambda.Function(this, 'CreateTodoFunction', {
      functionName: 'create-todo',
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
            console.log('Create todo function called');
            console.log('Event body:', event.body);
            
            try {
                const { title, description, userId } = JSON.parse(event.body);
                
                if (!title) {
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ error: 'Title is required' })
                    };
                }

                const todo = {
                    id: Date.now().toString(),
                    title,
                    description: description || '',
                    completed: false,
                    userId: userId || 'default',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                console.log('Todo to create:', JSON.stringify(todo, null, 2));
                console.log('Table name:', process.env.TABLE_NAME);

                // Save to DynamoDB
                await dynamodb.put({
                    TableName: process.env.TABLE_NAME,
                    Item: todo
                }).promise();

                console.log('Todo saved to DynamoDB successfully');

                return {
                    statusCode: 201,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(todo)
                };
            } catch (error) {
                console.error('Error creating todo:', error);
                console.error('Error stack:', error.stack);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ 
                        error: 'Internal server error',
                        message: error.message,
                        stack: error.stack
                    })
                };
            }
        };
      `),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: todoTable.tableName,
      },
    });

    // Lambda function for getting todos
    const getTodosFunction = new lambda.Function(this, 'GetTodosFunction', {
      functionName: 'get-todos',
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const dynamodbService = new AWS.DynamoDB();
        
        exports.handler = async (event) => {
            console.log('Get todos function called');
            
            try {
                const { id } = event.pathParameters || {};
                const tableName = process.env.TABLE_NAME;
                console.log('Table name:', tableName);
                console.log('Looking for ID:', id);
                
                if (id) {
                    // Get specific todo
                    console.log('Getting specific todo with ID:', id);
                    const result = await dynamodb.get({
                        TableName: tableName,
                        Key: { id }
                    }).promise();
                    
                    console.log('DynamoDB result:', JSON.stringify(result, null, 2));
                    
                    if (!result.Item) {
                        return {
                            statusCode: 404,
                            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                            body: JSON.stringify({ error: 'Todo not found' })
                        };
                    }
                    
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify(result.Item)
                    };
                } else {
                    // Get all todos
                    console.log('Getting all todos');
                    const result = await dynamodb.scan({
                        TableName: tableName
                    }).promise();
                    
                    console.log('DynamoDB scan result:', JSON.stringify(result, null, 2));
                    
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify(result.Items || [])
                    };
                }
            } catch (error) {
                console.error('Error getting todos:', error);
                console.error('Error stack:', error.stack);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ 
                        error: 'Internal server error',
                        message: error.message
                    })
                };
            }
        };
      `),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: todoTable.tableName,
      },
    });

    // Lambda function for updating todos
    const updateTodoFunction = new lambda.Function(this, 'UpdateTodoFunction', {
      functionName: 'update-todo',
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
            try {
                const { id } = event.pathParameters || {};
                const { title, description, completed } = JSON.parse(event.body);
                
                if (!id) {
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ error: 'Todo ID is required' })
                    };
                }
                
                const updateExpression = [];
                const expressionAttributeValues = {};
                const expressionAttributeNames = {};
                
                if (title !== undefined) {
                    updateExpression.push('#title = :title');
                    expressionAttributeValues[':title'] = title;
                    expressionAttributeNames['#title'] = 'title';
                }
                
                if (description !== undefined) {
                    updateExpression.push('#description = :description');
                    expressionAttributeValues[':description'] = description;
                    expressionAttributeNames['#description'] = 'description';
                }
                
                if (completed !== undefined) {
                    updateExpression.push('#completed = :completed');
                    expressionAttributeValues[':completed'] = completed;
                    expressionAttributeNames['#completed'] = 'completed';
                }
                
                updateExpression.push('#updatedAt = :updatedAt');
                expressionAttributeValues[':updatedAt'] = new Date().toISOString();
                expressionAttributeNames['#updatedAt'] = 'updatedAt';
                
                const result = await dynamodb.update({
                    TableName: process.env.TABLE_NAME,
                    Key: { id },
                    UpdateExpression: 'SET ' + updateExpression.join(', '),
                    ExpressionAttributeValues: expressionAttributeValues,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ReturnValues: 'ALL_NEW'
                }).promise();
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(result.Attributes)
                };
            } catch (error) {
                console.error('Error updating todo:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Internal server error' })
                };
            }
        };
      `),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: todoTable.tableName,
      },
    });

    // Lambda function for deleting todos
    const deleteTodoFunction = new lambda.Function(this, 'DeleteTodoFunction', {
      functionName: 'delete-todo',
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
            try {
                const { id } = event.pathParameters || {};
                
                if (!id) {
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ error: 'Todo ID is required' })
                    };
                }
                
                await dynamodb.delete({
                    TableName: process.env.TABLE_NAME,
                    Key: { id }
                }).promise();
                
                return {
                    statusCode: 204,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: ''
                };
            } catch (error) {
                console.error('Error deleting todo:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Internal server error' })
                };
            }
        };
      `),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: todoTable.tableName,
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'TodoApi', {
      restApiName: 'Todo API',
      description: 'API for Todo application',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // API Gateway resources and methods
    const todos = api.root.addResource('todos');
    
    // GET /todos - List all todos
    todos.addMethod('GET', new apigateway.LambdaIntegration(getTodosFunction));
    
    // POST /todos - Create a new todo
    todos.addMethod('POST', new apigateway.LambdaIntegration(createTodoFunction));

    // GET /todos/{id} - Get a specific todo
    const todo = todos.addResource('{id}');
    todo.addMethod('GET', new apigateway.LambdaIntegration(getTodosFunction));
    
    // PUT /todos/{id} - Update a todo
    todo.addMethod('PUT', new apigateway.LambdaIntegration(updateTodoFunction));
    
    // DELETE /todos/{id} - Delete a todo
    todo.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTodoFunction));

    // Output the table name
    new cdk.CfnOutput(this, 'TableName', {
      value: todoTable.tableName,
      description: 'DynamoDB Table Name',
    });

    // Output the Lambda function names
    new cdk.CfnOutput(this, 'CreateTodoFunctionName', {
      value: createTodoFunction.functionName,
      description: 'Create Todo Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'GetTodosFunctionName', {
      value: getTodosFunction.functionName,
      description: 'Get Todos Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'UpdateTodoFunctionName', {
      value: updateTodoFunction.functionName,
      description: 'Update Todo Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'DeleteTodoFunctionName', {
      value: deleteTodoFunction.functionName,
      description: 'Delete Todo Lambda Function Name',
    });

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'TodoApiUrl',
    });
  }
}
