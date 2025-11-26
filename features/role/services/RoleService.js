const RoleRepo = require('../repository/role.repository');


class RoleService{


    static async addRole(data){

       try {
            let result = await RoleRepo.create(data);
            return {status : 200 , message : "Created" , result : result}
       } catch (error) {
            throw error;
       }     
       
    }

    static async verifyRole(data){

     try {
          let toverifyrole = await RoleRepo.getByName(data);
         return toverifyrole;
     } catch (error) {
          console.log(error);
        throw error;
     }

    }


}

module.exports = RoleService
